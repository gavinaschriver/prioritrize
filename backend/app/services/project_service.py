import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.project import (
    ProjectCreate, ProjectUpdate, ProjectUpdateCreate,
    ProjectOut, ProjectDetailOut, ProjectUpdateOut,
    ProjectTaskCreate, ProjectTaskUpdate, ProjectTaskOut,
)
from app.services import category_service
from app.models.todo import TodoOut
from app.services.scoring_service import earliest_affected_day, record_deferral, rescore_from


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def _rescore_for(conn, user_id, tz_str, *rows):
    """Rescore the past days a project/task change touched.

    An overdue item docks points on every day it stayed open, so re-dating or
    deleting one moves a whole range of past days rather than a single one.
    """
    start = earliest_affected_day(
        tz_str,
        due_dates=[r["due_date"] for r in rows if r],
        timestamps=[r["completed_at"] for r in rows if r],
    )
    await rescore_from(user_id, start, tz_str, conn)


_PROJECT_COLS = "id, user_id, name, point_value, due_date, overview, category_id, sort_order, completed_at, created_at, updated_at"
_TASK_COLS = "id, project_id, user_id, name, point_value, due_date, description, comment, completed_at, created_at, updated_at"


async def list_projects(conn: asyncpg.Connection, user_id: str) -> list[ProjectOut]:
    uid = to_uuid(user_id)
    rows = await conn.fetch(
        f"""
        SELECT {_PROJECT_COLS}
        FROM project
        WHERE user_id = $1
        ORDER BY sort_order ASC, created_at ASC
        """,
        uid,
    )
    return [ProjectOut(**dict(r)) for r in rows]


async def get_project(conn: asyncpg.Connection, project_id: UUID, user_id: str) -> ProjectDetailOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        f"""
        SELECT {_PROJECT_COLS}
        FROM project
        WHERE id = $1 AND user_id = $2
        """,
        project_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    update_rows = await conn.fetch(
        """
        SELECT id, project_id, user_id, body, created_at
        FROM project_update
        WHERE project_id = $1
        ORDER BY created_at DESC
        """,
        project_id,
    )
    task_rows = await conn.fetch(
        f"""
        SELECT {_TASK_COLS}
        FROM project_task
        WHERE project_id = $1
        ORDER BY due_date ASC NULLS LAST, created_at ASC
        """,
        project_id,
    )
    updates = [ProjectUpdateOut(**dict(u)) for u in update_rows]
    tasks = [ProjectTaskOut(**dict(t)) for t in task_rows]
    return ProjectDetailOut(**dict(row), updates=updates, tasks=tasks)


async def create_project(conn: asyncpg.Connection, user_id: str, data: ProjectCreate) -> ProjectOut:
    uid = to_uuid(user_id)
    await category_service.assert_owned(conn, data.category_id, uid)
    row = await conn.fetchrow(
        f"""
        INSERT INTO project (user_id, name, point_value, due_date, overview, category_id, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6,
                COALESCE((SELECT MAX(sort_order) + 1 FROM project WHERE user_id = $1), 0))
        RETURNING {_PROJECT_COLS}
        """,
        uid, data.name, data.point_value, data.due_date, data.overview, data.category_id,
    )
    return ProjectOut(**dict(row))


async def update_project(conn: asyncpg.Connection, project_id: UUID, user_id: str, data: ProjectUpdate, tz_str: str = "UTC") -> ProjectOut:
    uid = to_uuid(user_id)
    before = await conn.fetchrow(
        f"SELECT {_PROJECT_COLS} FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Project not found")
    row = before

    # Include fields explicitly set (allow nulling out due_date/point_value)
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if "category_id" in updates:
        await category_service.assert_owned(conn, updates["category_id"], uid)
    if not updates:
        row = await conn.fetchrow(
            f"SELECT {_PROJECT_COLS} FROM project WHERE id = $1",
            project_id,
        )
        return ProjectOut(**dict(row))

    set_clauses = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await conn.fetchrow(
        f"""
        UPDATE project SET {set_clauses}, updated_at = now()
        WHERE id = $1
        RETURNING {_PROJECT_COLS}
        """,
        project_id, *values,
    )
    # Logged before the rescore, not after: rescore_from recomputes those days from
    # live data, so a deferral recorded afterwards would have nothing left to protect.
    if before["due_date"] != row["due_date"]:
        await record_deferral(
            conn, user_id, "project", project_id, before, row["due_date"], tz_str
        )
    # Both rows: moving a due date later still changes the days it used to dock.
    if before["due_date"] != row["due_date"] or before["point_value"] != row["point_value"]:
        await _rescore_for(conn, user_id, tz_str, before, row)
    return ProjectOut(**dict(row))


async def complete_project(conn: asyncpg.Connection, project_id: UUID, user_id: str) -> ProjectOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        f"""
        UPDATE project SET completed_at = now(), updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING {_PROJECT_COLS}
        """,
        project_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut(**dict(row))


async def uncomplete_project(conn: asyncpg.Connection, project_id: UUID, user_id: str, tz_str: str = "UTC") -> ProjectOut:
    uid = to_uuid(user_id)
    # Read the old completion day before it is overwritten with NULL.
    before = await conn.fetchrow(
        f"SELECT {_PROJECT_COLS} FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Project not found")

    row = await conn.fetchrow(
        f"""
        UPDATE project SET completed_at = NULL, updated_at = now()
        WHERE id = $1
        RETURNING {_PROJECT_COLS}
        """,
        project_id,
    )
    await _rescore_for(conn, user_id, tz_str, before)
    return ProjectOut(**dict(row))


async def delete_project(conn: asyncpg.Connection, project_id: UUID, user_id: str, tz_str: str = "UTC") -> dict:
    uid = to_uuid(user_id)
    # Tasks cascade with the project, so their scoring days move too.
    before = await conn.fetch(
        """
        SELECT due_date, completed_at FROM project WHERE id = $1 AND user_id = $2
        UNION ALL
        SELECT due_date, completed_at FROM project_task WHERE project_id = $1 AND user_id = $2
        """,
        project_id, uid,
    )
    result = await conn.execute(
        "DELETE FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Project not found")
    await _rescore_for(conn, user_id, tz_str, *before)
    return {"deleted": True}


async def reorder_projects(conn: asyncpg.Connection, user_id: str, ids: list[UUID]) -> list[ProjectOut]:
    """Rewrite sort_order from the position of each id in `ids`.

    Rows the caller left out keep whatever order they had, which puts them ahead
    of the reordered block; the client always sends the full list, so that only
    happens if a project was created in another tab mid-drag.
    """
    uid = to_uuid(user_id)
    await conn.execute(
        """
        UPDATE project SET sort_order = o.pos, updated_at = now()
        FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, pos)
        WHERE project.id = o.id AND project.user_id = $1
        """,
        uid, ids,
    )
    return await list_projects(conn, user_id)


# --- Project Updates ---

async def add_update(conn: asyncpg.Connection, project_id: UUID, user_id: str, data: ProjectUpdateCreate) -> ProjectUpdateOut:
    uid = to_uuid(user_id)
    exists = await conn.fetchval(
        "SELECT id FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Project not found")
    row = await conn.fetchrow(
        """
        INSERT INTO project_update (project_id, user_id, body)
        VALUES ($1, $2, $3)
        RETURNING id, project_id, user_id, body, created_at
        """,
        project_id, uid, data.body,
    )
    return ProjectUpdateOut(**dict(row))


async def edit_update(conn: asyncpg.Connection, update_id: UUID, user_id: str, data: ProjectUpdateCreate) -> ProjectUpdateOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        UPDATE project_update SET body = $1
        WHERE id = $2 AND user_id = $3
        RETURNING id, project_id, user_id, body, created_at
        """,
        data.body, update_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Update not found")
    return ProjectUpdateOut(**dict(row))


async def delete_update(conn: asyncpg.Connection, update_id: UUID, user_id: str) -> dict:
    uid = to_uuid(user_id)
    result = await conn.execute(
        "DELETE FROM project_update WHERE id = $1 AND user_id = $2",
        update_id, uid,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Update not found")
    return {"deleted": True}


# --- Project Tasks ---

async def create_task(conn: asyncpg.Connection, project_id: UUID, user_id: str, data: ProjectTaskCreate) -> ProjectTaskOut:
    uid = to_uuid(user_id)
    exists = await conn.fetchval(
        "SELECT id FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Project not found")
    row = await conn.fetchrow(
        f"""
        INSERT INTO project_task (project_id, user_id, name, point_value, due_date, description, comment)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING {_TASK_COLS}
        """,
        project_id, uid, data.name, data.point_value, data.due_date, data.description, data.comment,
    )
    return ProjectTaskOut(**dict(row))


async def update_task(conn: asyncpg.Connection, task_id: UUID, user_id: str, data: ProjectTaskUpdate, tz_str: str = "UTC") -> ProjectTaskOut:
    uid = to_uuid(user_id)
    before = await conn.fetchrow(
        f"SELECT {_TASK_COLS} FROM project_task WHERE id = $1 AND user_id = $2",
        task_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        row = await conn.fetchrow(
            f"SELECT {_TASK_COLS} FROM project_task WHERE id = $1",
            task_id,
        )
        return ProjectTaskOut(**dict(row))

    set_clauses = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await conn.fetchrow(
        f"""
        UPDATE project_task SET {set_clauses}, updated_at = now()
        WHERE id = $1
        RETURNING {_TASK_COLS}
        """,
        task_id, *values,
    )
    # Logged before the rescore, not after: rescore_from recomputes those days from
    # live data, so a deferral recorded afterwards would have nothing left to protect.
    if before["due_date"] != row["due_date"]:
        await record_deferral(
            conn, user_id, "task", task_id, before, row["due_date"], tz_str
        )
    # Both rows: moving a due date later still changes the days it used to dock.
    if before["due_date"] != row["due_date"] or before["point_value"] != row["point_value"]:
        await _rescore_for(conn, user_id, tz_str, before, row)
    return ProjectTaskOut(**dict(row))


async def complete_task(conn: asyncpg.Connection, task_id: UUID, user_id: str) -> ProjectTaskOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        f"""
        UPDATE project_task SET completed_at = now(), updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING {_TASK_COLS}
        """,
        task_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return ProjectTaskOut(**dict(row))


async def uncomplete_task(conn: asyncpg.Connection, task_id: UUID, user_id: str, tz_str: str = "UTC") -> ProjectTaskOut:
    uid = to_uuid(user_id)
    # Read the old completion day first: RETURNING hands back the post-update row,
    # where completed_at is already NULL and the day it earned on is unrecoverable.
    before = await conn.fetchrow(
        f"SELECT {_TASK_COLS} FROM project_task WHERE id = $1 AND user_id = $2",
        task_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Task not found")

    row = await conn.fetchrow(
        f"""
        UPDATE project_task SET completed_at = NULL, updated_at = now()
        WHERE id = $1
        RETURNING {_TASK_COLS}
        """,
        task_id,
    )
    await _rescore_for(conn, user_id, tz_str, before)
    return ProjectTaskOut(**dict(row))


async def delete_task(conn: asyncpg.Connection, task_id: UUID, user_id: str, tz_str: str = "UTC") -> dict:
    uid = to_uuid(user_id)
    before = await conn.fetchrow(
        f"SELECT {_TASK_COLS} FROM project_task WHERE id = $1 AND user_id = $2",
        task_id, uid,
    )
    if not before:
        raise HTTPException(status_code=404, detail="Task not found")

    await conn.execute("DELETE FROM project_task WHERE id = $1", task_id)
    # The row is gone, so every day it earned or docked on has to be rescored.
    await _rescore_for(conn, user_id, tz_str, before)
    return {"deleted": True}


_TODO_COLS = "id, user_id, name, point_value, due_date, description, comment, category_id, completed_at, created_at, updated_at"


async def convert_task_to_todo(conn: asyncpg.Connection, task_id: UUID, user_id: str) -> TodoOut:
    """Detach a task from its project and put it back in the standalone todo list.
    Everything except the project link and the id survives the move."""
    uid = to_uuid(user_id)
    task = await conn.fetchrow(
        f"SELECT {_TASK_COLS} FROM project_task WHERE id = $1 AND user_id = $2",
        task_id, uid,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # The project's category comes along: the task is leaving the project, but
    # "Vehicle Work" describes the work itself and still applies to it as a todo.
    # Looked up separately rather than joined -- project and project_task share
    # almost every column name, so a joined _TASK_COLS would be ambiguous.
    category_id = await conn.fetchval(
        "SELECT category_id FROM project WHERE id = $1", task["project_id"],
    )

    async with conn.transaction():
        todo = await conn.fetchrow(
            f"""
            INSERT INTO todo
                (user_id, name, point_value, due_date, description, comment, category_id, completed_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING {_TODO_COLS}
            """,
            uid, task["name"], task["point_value"], task["due_date"],
            task["description"], task["comment"], category_id,
            task["completed_at"], task["created_at"],
        )
        await conn.execute("DELETE FROM project_task WHERE id = $1", task_id)

    return TodoOut(**dict(todo))
