import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.project import (
    ProjectCreate, ProjectUpdate, ProjectUpdateCreate,
    ProjectOut, ProjectDetailOut, ProjectUpdateOut,
    ProjectTaskCreate, ProjectTaskUpdate, ProjectTaskOut,
)


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


_TASK_COLS = "id, project_id, user_id, name, point_value, due_date, comment, completed_at, created_at, updated_at"


async def list_projects(conn: asyncpg.Connection, user_id: str) -> list[ProjectOut]:
    uid = to_uuid(user_id)
    rows = await conn.fetch(
        """
        SELECT id, user_id, name, point_value, due_date, overview, completed_at, created_at, updated_at
        FROM project
        WHERE user_id = $1
        ORDER BY due_date ASC NULLS LAST, created_at ASC
        """,
        uid,
    )
    return [ProjectOut(**dict(r)) for r in rows]


async def get_project(conn: asyncpg.Connection, project_id: UUID, user_id: str) -> ProjectDetailOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        SELECT id, user_id, name, point_value, due_date, overview, completed_at, created_at, updated_at
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
        ORDER BY created_at ASC
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
    row = await conn.fetchrow(
        """
        INSERT INTO project (user_id, name, point_value, due_date, overview)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, name, point_value, due_date, overview, completed_at, created_at, updated_at
        """,
        uid, data.name, data.point_value, data.due_date, data.overview,
    )
    return ProjectOut(**dict(row))


async def update_project(conn: asyncpg.Connection, project_id: UUID, user_id: str, data: ProjectUpdate) -> ProjectOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        "SELECT id FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    # Include fields explicitly set (allow nulling out due_date/point_value)
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not updates:
        row = await conn.fetchrow(
            "SELECT id, user_id, name, point_value, due_date, overview, completed_at, created_at, updated_at FROM project WHERE id = $1",
            project_id,
        )
        return ProjectOut(**dict(row))

    set_clauses = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await conn.fetchrow(
        f"""
        UPDATE project SET {set_clauses}, updated_at = now()
        WHERE id = $1
        RETURNING id, user_id, name, point_value, due_date, overview, completed_at, created_at, updated_at
        """,
        project_id, *values,
    )
    return ProjectOut(**dict(row))


async def complete_project(conn: asyncpg.Connection, project_id: UUID, user_id: str) -> ProjectOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        UPDATE project SET completed_at = now(), updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, name, point_value, due_date, overview, completed_at, created_at, updated_at
        """,
        project_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut(**dict(row))


async def uncomplete_project(conn: asyncpg.Connection, project_id: UUID, user_id: str) -> ProjectOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        UPDATE project SET completed_at = NULL, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, name, point_value, due_date, overview, completed_at, created_at, updated_at
        """,
        project_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut(**dict(row))


async def delete_project(conn: asyncpg.Connection, project_id: UUID, user_id: str) -> dict:
    uid = to_uuid(user_id)
    result = await conn.execute(
        "DELETE FROM project WHERE id = $1 AND user_id = $2",
        project_id, uid,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True}


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
        INSERT INTO project_task (project_id, user_id, name, point_value, due_date, comment)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING {_TASK_COLS}
        """,
        project_id, uid, data.name, data.point_value, data.due_date, data.comment,
    )
    return ProjectTaskOut(**dict(row))


async def update_task(conn: asyncpg.Connection, task_id: UUID, user_id: str, data: ProjectTaskUpdate) -> ProjectTaskOut:
    uid = to_uuid(user_id)
    exists = await conn.fetchval(
        "SELECT id FROM project_task WHERE id = $1 AND user_id = $2",
        task_id, uid,
    )
    if not exists:
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


async def uncomplete_task(conn: asyncpg.Connection, task_id: UUID, user_id: str) -> ProjectTaskOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        f"""
        UPDATE project_task SET completed_at = NULL, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING {_TASK_COLS}
        """,
        task_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return ProjectTaskOut(**dict(row))


async def delete_task(conn: asyncpg.Connection, task_id: UUID, user_id: str) -> dict:
    uid = to_uuid(user_id)
    result = await conn.execute(
        "DELETE FROM project_task WHERE id = $1 AND user_id = $2",
        task_id, uid,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Task not found")
    return {"deleted": True}
