import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.todo import TodoCreate, TodoUpdate, TodoOut
from app.models.project import ProjectTaskOut


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


_COLS = "id, user_id, name, point_value, due_date, comment, completed_at, created_at, updated_at"


async def list_todos(conn: asyncpg.Connection, user_id: str) -> list[TodoOut]:
    uid = to_uuid(user_id)
    rows = await conn.fetch(
        f"SELECT {_COLS} FROM todo WHERE user_id = $1 ORDER BY created_at ASC",
        uid,
    )
    return [TodoOut(**dict(r)) for r in rows]


async def create_todo(conn: asyncpg.Connection, user_id: str, data: TodoCreate) -> TodoOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        f"""
        INSERT INTO todo (user_id, name, point_value, due_date, comment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING {_COLS}
        """,
        uid, data.name, data.point_value, data.due_date, data.comment,
    )
    return TodoOut(**dict(row))


async def update_todo(conn: asyncpg.Connection, todo_id: UUID, user_id: str, data: TodoUpdate) -> TodoOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        "SELECT id FROM todo WHERE id = $1 AND user_id = $2",
        todo_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Todo not found")

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        row = await conn.fetchrow(f"SELECT {_COLS} FROM todo WHERE id = $1", todo_id)
        return TodoOut(**dict(row))

    set_clauses = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await conn.fetchrow(
        f"UPDATE todo SET {set_clauses}, updated_at = now() WHERE id = $1 RETURNING {_COLS}",
        todo_id, *values,
    )
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


async def uncomplete_todo(conn: asyncpg.Connection, todo_id: UUID, user_id: str) -> TodoOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        f"UPDATE todo SET completed_at = NULL, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING {_COLS}",
        todo_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Todo not found")
    return TodoOut(**dict(row))


async def delete_todo(conn: asyncpg.Connection, todo_id: UUID, user_id: str) -> dict:
    uid = to_uuid(user_id)
    result = await conn.execute(
        "DELETE FROM todo WHERE id = $1 AND user_id = $2",
        todo_id, uid,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Todo not found")
    return {"deleted": True}


_TASK_COLS = "id, project_id, user_id, name, point_value, due_date, comment, completed_at, created_at, updated_at"


async def convert_to_task(
    conn: asyncpg.Connection, todo_id: UUID, user_id: str, project_id: UUID
) -> ProjectTaskOut:
    """Move a todo into a project. Same row, different table: name, points, due date,
    comment, completion state and original created_at all carry over. The id does not."""
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
                (project_id, user_id, name, point_value, due_date, comment, completed_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING {_TASK_COLS}
            """,
            project_id, uid, todo["name"], todo["point_value"], todo["due_date"],
            todo["comment"], todo["completed_at"], todo["created_at"],
        )
        await conn.execute("DELETE FROM todo WHERE id = $1", todo_id)

    return ProjectTaskOut(**dict(task))
