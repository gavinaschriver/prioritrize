import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.todo import TodoCreate, TodoUpdate, TodoOut


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def list_todos(conn: asyncpg.Connection, user_id: str) -> list[TodoOut]:
    uid = to_uuid(user_id)
    rows = await conn.fetch(
        """
        SELECT id, user_id, name, point_value, completed_at, created_at, updated_at
        FROM todo
        WHERE user_id = $1
        ORDER BY created_at ASC
        """,
        uid,
    )
    return [TodoOut(**dict(r)) for r in rows]


async def create_todo(conn: asyncpg.Connection, user_id: str, data: TodoCreate) -> TodoOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        INSERT INTO todo (user_id, name, point_value)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, name, point_value, completed_at, created_at, updated_at
        """,
        uid, data.name, data.point_value,
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

    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        row = await conn.fetchrow(
            "SELECT id, user_id, name, point_value, completed_at, created_at, updated_at FROM todo WHERE id = $1",
            todo_id,
        )
        return TodoOut(**dict(row))

    set_clauses = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await conn.fetchrow(
        f"""
        UPDATE todo SET {set_clauses}, updated_at = now()
        WHERE id = $1
        RETURNING id, user_id, name, point_value, completed_at, created_at, updated_at
        """,
        todo_id, *values,
    )
    return TodoOut(**dict(row))


async def complete_todo(conn: asyncpg.Connection, todo_id: UUID, user_id: str) -> TodoOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        UPDATE todo SET completed_at = now(), updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, name, point_value, completed_at, created_at, updated_at
        """,
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
