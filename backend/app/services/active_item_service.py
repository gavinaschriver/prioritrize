import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.active_item import ActiveItemSet, ActiveItemOut, ActiveEntityType


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


_COLS = "entity_type, entity_id, started_at"

_OWNER_SQL = {
    "todo": "SELECT 1 FROM todo WHERE id = $1 AND user_id = $2 AND completed_at IS NULL",
    "project_task": "SELECT 1 FROM project_task WHERE id = $1 AND user_id = $2 AND completed_at IS NULL",
}


async def get_active(conn: asyncpg.Connection, user_id: str) -> ActiveItemOut | None:
    row = await conn.fetchrow(
        f"SELECT {_COLS} FROM active_item WHERE user_id = $1", to_uuid(user_id)
    )
    return ActiveItemOut(**dict(row)) if row else None


async def set_active(conn: asyncpg.Connection, user_id: str, data: ActiveItemSet) -> ActiveItemOut:
    """Activating anything deactivates whatever was there -- one row, one upsert."""
    uid = to_uuid(user_id)
    owned = await conn.fetchval(_OWNER_SQL[data.entity_type], data.entity_id, uid)
    if not owned:
        raise HTTPException(404, "That item isn't yours, or is already complete")

    row = await conn.fetchrow(
        f"""
        INSERT INTO active_item (user_id, entity_type, entity_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE
            SET entity_type = $2, entity_id = $3, started_at = now()
        RETURNING {_COLS}
        """,
        uid, data.entity_type, data.entity_id,
    )
    return ActiveItemOut(**dict(row))


async def clear_active(conn: asyncpg.Connection, user_id: str) -> dict:
    await conn.execute("DELETE FROM active_item WHERE user_id = $1", to_uuid(user_id))
    return {"status": "cleared"}


async def release(
    conn: asyncpg.Connection, user_id: str, entity_type: ActiveEntityType, entity_id: UUID
) -> None:
    """Drop the pointer if it names this item.

    Called when something is completed, deleted or converted: the bullpen must not
    keep pointing at work that is finished or no longer exists. Safe to call for
    anything -- it only deletes when the ids actually match.
    """
    await conn.execute(
        """
        DELETE FROM active_item
        WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3
        """,
        to_uuid(user_id), entity_type, entity_id,
    )
