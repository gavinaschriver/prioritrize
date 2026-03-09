import asyncpg
from uuid import UUID
from app.models.scratch_pad import ScratchPadOut, ScratchPadUpdate


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def get_scratch_pad(conn: asyncpg.Connection, user_id: str) -> ScratchPadOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        INSERT INTO scratch_pad (user_id, content)
        VALUES ($1, '')
        ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        RETURNING content, updated_at
        """,
        uid,
    )
    return ScratchPadOut(**dict(row))


async def update_scratch_pad(conn: asyncpg.Connection, user_id: str, data: ScratchPadUpdate) -> ScratchPadOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        INSERT INTO scratch_pad (user_id, content, updated_at)
        VALUES ($1, $2, now())
        ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content, updated_at = now()
        RETURNING content, updated_at
        """,
        uid, data.content,
    )
    return ScratchPadOut(**dict(row))
