import asyncpg
from uuid import UUID
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app.models.entry import EntryCreate, EntryOut
from app.utils.timezone import get_day_boundaries_utc, get_today_str
from app.services.scoring_service import upsert_snapshot


def to_uuid(val: str | UUID) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def create_entry(
    user_id: str, data: EntryCreate, tz_str: str, conn: asyncpg.Connection
) -> EntryOut:
    uid = to_uuid(user_id)
    pri_id = to_uuid(str(data.prioritri_id))

    prioritri = await conn.fetchrow(
        "SELECT * FROM prioritri WHERE id = $1 AND user_id = $2 AND is_active = true",
        pri_id, uid,
    )
    if not prioritri:
        raise HTTPException(404, "Prioritri not found")

    today_str = get_today_str(tz_str)
    target_date = data.target_date or today_str
    start_utc, end_utc = get_day_boundaries_utc(target_date, tz_str)

    if not prioritri["can_repeat"]:
        existing_count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM entry
            WHERE prioritri_id = $1 AND user_id = $2
              AND created_at >= $3 AND created_at < $4
            """,
            pri_id, uid, start_utc, end_utc,
        )
        if existing_count > 0:
            raise HTTPException(409, "Cannot add repeat entry; can_repeat is false")

    if data.target_date and data.target_date != today_str:
        tz = ZoneInfo(tz_str)
        created_at = datetime.strptime(data.target_date, "%Y-%m-%d").replace(
            hour=12, tzinfo=tz
        )
        row = await conn.fetchrow(
            """
            INSERT INTO entry (prioritri_id, user_id, comment, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            pri_id, uid, data.comment, created_at,
        )
        await upsert_snapshot(user_id, data.target_date, tz_str, conn)
    else:
        row = await conn.fetchrow(
            """
            INSERT INTO entry (prioritri_id, user_id, comment)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            pri_id, uid, data.comment,
        )

    return EntryOut(**dict(row), prioritri_name=prioritri["name"])


async def delete_entry(
    user_id: str, entry_id: UUID, tz_str: str, conn: asyncpg.Connection
) -> dict:
    uid = to_uuid(user_id)
    entry = await conn.fetchrow(
        "SELECT * FROM entry WHERE id = $1 AND user_id = $2",
        entry_id, uid,
    )
    if not entry:
        raise HTTPException(404, "Entry not found")

    await conn.execute("DELETE FROM entry WHERE id = $1", entry_id)

    today_str = get_today_str(tz_str)
    start_utc, end_utc = get_day_boundaries_utc(today_str, tz_str)
    if entry["created_at"] < start_utc:
        tz = ZoneInfo(tz_str)
        entry_date = entry["created_at"].astimezone(tz).strftime("%Y-%m-%d")
        await upsert_snapshot(user_id, entry_date, tz_str, conn)

    return {"deleted": True}


async def list_entries_for_day(
    user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection
) -> list[EntryOut]:
    uid = to_uuid(user_id)
    start_utc, end_utc = get_day_boundaries_utc(date_str, tz_str)
    rows = await conn.fetch(
        """
        SELECT e.*, p.name AS prioritri_name
        FROM entry e
        JOIN prioritri p ON p.id = e.prioritri_id
        WHERE e.user_id = $1
          AND e.created_at >= $2
          AND e.created_at < $3
        ORDER BY e.created_at DESC
        """,
        uid, start_utc, end_utc,
    )
    return [EntryOut(**dict(r)) for r in rows]
