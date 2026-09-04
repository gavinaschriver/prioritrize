import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.prioritry import PrioritryCreate, PrioritryUpdate, PrioritryOut


def to_uuid(val: str | UUID) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def list_prioritries(user_id: str, active_only: bool, conn: asyncpg.Connection) -> list[PrioritryOut]:
    uid = to_uuid(user_id)
    where = "p.user_id = $1"
    if active_only:
        where += " AND p.is_active = true"
    rows = await conn.fetch(
        f"""
        SELECT p.*, t.name AS type_name
        FROM prioritry p JOIN type t ON t.id = p.type_id
        WHERE {where}
        ORDER BY t.name ASC, p.point_value DESC
        """,
        uid,
    )
    return [PrioritryOut(**dict(r)) for r in rows]


async def create_prioritry(user_id: str, data: PrioritryCreate, conn: asyncpg.Connection) -> PrioritryOut:
    uid = to_uuid(user_id)
    type_row = await conn.fetchrow("SELECT id, name FROM type WHERE id = $1", data.type_id)
    if not type_row:
        raise HTTPException(400, "Invalid type_id")

    row = await conn.fetchrow(
        """
        INSERT INTO prioritry (user_id, name, type_id, point_value, can_repeat, timeblock,
                               comments_enabled, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        """,
        uid, data.name, data.type_id, data.point_value, data.can_repeat,
        data.timeblock, data.comments_enabled, data.description,
    )
    return PrioritryOut(**dict(row), type_name=type_row["name"])


async def update_prioritry(user_id: str, prioritry_id: UUID, data: PrioritryUpdate, conn: asyncpg.Connection) -> PrioritryOut:
    uid = to_uuid(user_id)
    existing = await conn.fetchrow(
        "SELECT p.*, t.name AS type_name FROM prioritry p JOIN type t ON t.id = p.type_id WHERE p.id = $1 AND p.user_id = $2",
        prioritry_id, uid,
    )
    if not existing:
        raise HTTPException(404, "PrioriTry not found")

    updates = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        updates[field] = value

    if not updates:
        return PrioritryOut(**dict(existing))

    final_type_id = updates.get("type_id", existing["type_id"])
    type_row = await conn.fetchrow("SELECT name FROM type WHERE id = $1", final_type_id)

    set_clauses = []
    params = [prioritry_id, uid]
    for i, (field, value) in enumerate(updates.items(), start=3):
        set_clauses.append(f"{field} = ${i}")
        params.append(value)

    row = await conn.fetchrow(
        f"""
        UPDATE prioritry SET {', '.join(set_clauses)}
        WHERE id = $1 AND user_id = $2
        RETURNING *
        """,
        *params,
    )
    return PrioritryOut(**dict(row), type_name=type_row["name"])


async def delete_prioritry(user_id: str, prioritry_id: UUID, conn: asyncpg.Connection) -> PrioritryOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        UPDATE prioritry SET is_active = false
        WHERE id = $1 AND user_id = $2
        RETURNING *
        """,
        prioritry_id, uid,
    )
    if not row:
        raise HTTPException(404, "PrioriTry not found")
    type_row = await conn.fetchrow("SELECT name FROM type WHERE id = $1", row["type_id"])
    return PrioritryOut(**dict(row), type_name=type_row["name"])
