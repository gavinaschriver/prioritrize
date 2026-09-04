import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.todo import TodoCreate, TodoUpdate, TodoOut
from app.models.project import ProjectTaskOut
from app.services import category_service
from app.services.scoring_service import earliest_affected_day, record_deferral, rescore_from


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def _rescore_for(conn, user_id, tz_str, *rows):
    """Rescore the past days a todo change touched.

    An overdue todo docks points on every day it stayed open, so editing its due
    date or deleting it outright moves a whole range of past days, not one. Pass
    the row as it was before the change and, for edits, as it is after.
    """
    start = earliest_affected_day(
        tz_str,
        due_dates=[r["due_date"] for r in rows if r],
        timestamps=[r["completed_at"] for r in rows if r],
    )
    await rescore_from(user_id, start, tz_str, conn)


_COLS = "id, user_id, name, point_value, due_date, description, comment, category_id, completed_at, created_at, updated_at"


async def list_todos(conn: asyncpg.Connection, user_id: str) -> list[TodoOut]:
    uid = to_uuid(user_id)
    rows = await conn.fetch(
        f"SELECT {_COLS} FROM todo WHERE user_id = $1 ORDER BY created_at ASC",
        uid,
    )
    return [TodoOut(**dict(r)) for r in rows]


async def create_todo(conn: asyncpg.Connection, user_id: str, data: TodoCreate) -> TodoOut:
    uid = to_uuid(user_id)
    await category_service.assert_owned(conn, data.category_id, uid)
    row = await conn.fetchrow(
        f"""
        INSERT INTO todo (user_id, name, point_value, due_date, description, comment, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING {_COLS}
        """,
        uid, data.name, data.point_value, data.due_date, data.description, data.comment,
        data.category_id,
    )
    return TodoOut(**dict(row))


async def update_todo(
    conn: asyncpg.Connection, todo_id: UUID, user_id: str, data: TodoUpdate,
    tz_str: str = "UTC",
) -> TodoOut:
    uid = to_uuid(user_id)
    before = await conn.fetchrow(
        f"SELECT {_COLS} FROM todo WHERE id = $1 AND user_id = $2",
        todo_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Todo not found")

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return TodoOut(**dict(before))
    if "category_id" in updates:
        await category_service.assert_owned(conn, updates["category_id"], uid)

    set_clauses = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await conn.fetchrow(
        f"UPDATE todo SET {set_clauses}, updated_at = now() WHERE id = $1 RETURNING {_COLS}",
        todo_id, *values,
    )
    # Logged before the rescore, not after: rescore_from recomputes those days from
    # live data, so a deferral recorded afterwards would have nothing left to protect.
    if before["due_date"] != row["due_date"]:
        await record_deferral(
            conn, user_id, "todo", todo_id, before, row["due_date"], tz_str
        )
    # Both rows: moving a due date later still changes the days it used to dock.
    if before["due_date"] != row["due_date"] or before["point_value"] != row["point_value"]:
        await _rescore_for(conn, user_id, tz_str, before, row)
    return TodoOut(**dict(row))


async def complete_todo(conn: asyncpg.Connection, todo_id: UUID, user_id: str) -> TodoOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        f"UPDATE todo SET completed_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING {_COLS}",
        todo_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Todo not found")
    return TodoOut(**dict(row))


async def uncomplete_todo(
    conn: asyncpg.Connection, todo_id: UUID, user_id: str, tz_str: str = "UTC"
) -> TodoOut:
    uid = to_uuid(user_id)
    # Read the old completion day first: RETURNING hands back the post-update row,
    # where completed_at is already NULL and the day it earned on is unrecoverable.
    before = await conn.fetchrow(
        f"SELECT {_COLS} FROM todo WHERE id = $1 AND user_id = $2",
        todo_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Todo not found")

    row = await conn.fetchrow(
        f"UPDATE todo SET completed_at = NULL, updated_at = now() WHERE id = $1 RETURNING {_COLS}",
        todo_id,
    )
    await _rescore_for(conn, user_id, tz_str, before)
    return TodoOut(**dict(row))


async def delete_todo(
    conn: asyncpg.Connection, todo_id: UUID, user_id: str, tz_str: str = "UTC"
) -> dict:
    uid = to_uuid(user_id)
    before = await conn.fetchrow(
        f"SELECT {_COLS} FROM todo WHERE id = $1 AND user_id = $2",
        todo_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Todo not found")

    await conn.execute("DELETE FROM todo WHERE id = $1", todo_id)
    # The row is gone, so every day it earned or docked on has to be rescored.
    await _rescore_for(conn, user_id, tz_str, before)
    return {"deleted": True}


_TASK_COLS = "id, project_id, user_id, name, point_value, due_date, description, comment, completed_at, created_at, updated_at"


async def convert_to_task(
    conn: asyncpg.Connection, todo_id: UUID, user_id: str, project_id: UUID
) -> ProjectTaskOut:
    """Move a todo into a project. Same row, different table: name, points, due date,
    description, comment, completion state and original created_at all carry over.
    The id does not."""
    uid = to_uuid(user_id)
    todo = await conn.fetchrow(
        f"SELECT {_COLS} FROM todo WHERE id = $1 AND user_id = $2",
        todo_id, uid,
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    project_exists = await conn.fetchval(
        "SELECT id FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if not project_exists:
        raise HTTPException(status_code=404, detail="Project not found")

    async with conn.transaction():
        task = await conn.fetchrow(
            f"""
            INSERT INTO project_task
                (project_id, user_id, name, point_value, due_date, description, comment, completed_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING {_TASK_COLS}
            """,
            project_id, uid, todo["name"], todo["point_value"], todo["due_date"],
            todo["description"], todo["comment"], todo["completed_at"], todo["created_at"],
        )
        await conn.execute("DELETE FROM todo WHERE id = $1", todo_id)

    return ProjectTaskOut(**dict(task))
