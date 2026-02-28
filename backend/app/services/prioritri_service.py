import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.prioritri import PrioritriCreate, PrioritriUpdate, PrioritriOut


def to_uuid(val: str | UUID) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def list_prioritris(user_id: str, active_only: bool, conn: asyncpg.Connection) -> list[PrioritriOut]:
    uid = to_uuid(user_id)
    where = "p.user_id = $1"
    if active_only:
        where += " AND p.is_active = true"
    rows = await conn.fetch(
        f"""
        SELECT p.*, t.name AS type_name
        FROM prioritri p JOIN type t ON t.id = p.type_id
        WHERE {where}
        ORDER BY t.name ASC, p.point_value DESC
        """,
        uid,
    )
    return [PrioritriOut(**dict(r)) for r in rows]


async def create_prioritri(user_id: str, data: PrioritriCreate, conn: asyncpg.Connection) -> PrioritriOut:
    uid = to_uuid(user_id)
    type_row = await conn.fetchrow("SELECT id, name FROM type WHERE id = $1", data.type_id)
    if not type_row:
        raise HTTPException(400, "Invalid type_id")

    extra_penalty = data.extra_penalty
    if type_row["name"] == "Bonus":
        extra_penalty = 0

    row = await conn.fetchrow(
        """
        INSERT INTO prioritri (user_id, name, type_id, point_value, can_repeat, timeblock,
                               comments_enabled, extra_penalty)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        """,
        uid, data.name, data.type_id, data.point_value, data.can_repeat,
        data.timeblock, data.comments_enabled, extra_penalty,
    )
    return PrioritriOut(**dict(row), type_name=type_row["name"])


async def update_prioritri(user_id: str, prioritri_id: UUID, data: PrioritriUpdate, conn: asyncpg.Connection) -> PrioritriOut:
    uid = to_uuid(user_id)
    existing = await conn.fetchrow(
        "SELECT p.*, t.name AS type_name FROM prioritri p JOIN type t ON t.id = p.type_id WHERE p.id = $1 AND p.user_id = $2",
        prioritri_id, uid,
    )
    if not existing:
        raise HTTPException(404, "Prioritri not found")

    updates = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        updates[field] = value

    if not updates:
        return PrioritriOut(**dict(existing))

    final_type_id = updates.get("type_id", existing["type_id"])
    type_row = await conn.fetchrow("SELECT name FROM type WHERE id = $1", final_type_id)
    if type_row["name"] == "Bonus":
        updates["extra_penalty"] = 0

    set_clauses = []
    params = [prioritri_id, uid]
    for i, (field, value) in enumerate(updates.items(), start=3):
        set_clauses.append(f"{field} = ${i}")
        params.append(value)

    row = await conn.fetchrow(
        f"""
        UPDATE prioritri SET {', '.join(set_clauses)}
        WHERE id = $1 AND user_id = $2
        RETURNING *
        """,
        *params,
    )
    return PrioritriOut(**dict(row), type_name=type_row["name"])


async def delete_prioritri(user_id: str, prioritri_id: UUID, conn: asyncpg.Connection) -> PrioritriOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        UPDATE prioritri SET is_active = false
        WHERE id = $1 AND user_id = $2
        RETURNING *
        """,
        prioritri_id, uid,
    )
    if not row:
        raise HTTPException(404, "Prioritri not found")
    type_row = await conn.fetchrow("SELECT name FROM type WHERE id = $1", row["type_id"])
    return PrioritriOut(**dict(row), type_name=type_row["name"])
