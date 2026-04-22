import asyncpg
from uuid import UUID
from datetime import date as DateType
from app.models.daily_notes import DailyNotesOut, DailyNotesUpdate


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


def to_date(val) -> DateType:
    return DateType.fromisoformat(val) if isinstance(val, str) else val


async def get_daily_notes(conn: asyncpg.Connection, user_id: str, date: str) -> DailyNotesOut:
    uid = to_uuid(user_id)
    d = to_date(date)
    row = await conn.fetchrow(
        """
        INSERT INTO daily_notes (user_id, date, content)
        VALUES ($1, $2, '')
        ON CONFLICT (user_id, date) DO UPDATE SET user_id = EXCLUDED.user_id
        RETURNING content, date, updated_at
        """,
        uid, d,
    )
    return DailyNotesOut(**dict(row))


async def update_daily_notes(conn: asyncpg.Connection, user_id: str, date: str, data: DailyNotesUpdate) -> DailyNotesOut:
    uid = to_uuid(user_id)
    d = to_date(date)
    row = await conn.fetchrow(
        """
        INSERT INTO daily_notes (user_id, date, content, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (user_id, date) DO UPDATE SET content = EXCLUDED.content, updated_at = now()
        RETURNING content, date, updated_at
        """,
        uid, d, data.content,
    )
    return DailyNotesOut(**dict(row))
