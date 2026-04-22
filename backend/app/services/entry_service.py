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


def parse_tags(comment: str | None) -> list[str]:
    """Extract leading #tag segments from a comment string.
    E.g. '#long walk, #muay thai, felt great' → ['long walk', 'muay thai']
    """
    if not comment:
        return []
    tags = []
    for part in comment.split(', '):
        if part.startswith('#'):
            tag = part[1:].strip()
            if tag:
                tags.append(tag)
        else:
            break
    return tags


async def _sync_tags(
    entry_id: UUID, user_id: UUID, comment: str | None, conn: asyncpg.Connection
) -> None:
    """Delete existing tags for an entry and re-insert from the current comment."""
    await conn.execute("DELETE FROM entry_tag WHERE entry_id = $1", entry_id)
    tags = parse_tags(comment)
    if tags:
        await conn.executemany(
            "INSERT INTO entry_tag (entry_id, user_id, tag) VALUES ($1, $2, $3)",
            [(entry_id, user_id, tag) for tag in tags],
        )


async def create_entry(
    user_id: str, data: EntryCreate, tz_str: str, conn: asyncpg.Connection
) -> EntryOut:
    uid = to_uuid(user_id)
    pri_id = to_uuid(str(data.prioritry_id))

    prioritry = await conn.fetchrow(
        "SELECT * FROM prioritry WHERE id = $1 AND user_id = $2 AND is_active = true",
        pri_id, uid,
    )
    if not prioritry:
        raise HTTPException(404, "PrioriTry not found")

    today_str = get_today_str(tz_str)
    target_date = data.target_date or today_str
    start_utc, end_utc = get_day_boundaries_utc(target_date, tz_str)

    if not prioritry["can_repeat"]:
        existing_count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM entry
            WHERE prioritry_id = $1 AND user_id = $2
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
            INSERT INTO entry (prioritry_id, user_id, comment, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            pri_id, uid, data.comment, created_at,
        )
        await _sync_tags(row["id"], uid, data.comment, conn)
        await upsert_snapshot(user_id, data.target_date, tz_str, conn)
    else:
        row = await conn.fetchrow(
            """
            INSERT INTO entry (prioritry_id, user_id, comment)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            pri_id, uid, data.comment,
        )
        await _sync_tags(row["id"], uid, data.comment, conn)

    return EntryOut(**dict(row), prioritry_name=prioritry["name"])


async def update_entry(
    user_id: str, entry_id: UUID, comment: str | None, conn: asyncpg.Connection
) -> EntryOut:
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        UPDATE entry SET comment = $1
        WHERE id = $2 AND user_id = $3
        RETURNING *
        """,
        comment, entry_id, uid,
    )
    if not row:
        raise HTTPException(404, "Entry not found")

    await _sync_tags(row["id"], uid, comment, conn)

    prioritry = await conn.fetchrow(
        "SELECT name FROM prioritry WHERE id = $1", row["prioritry_id"]
    )
    return EntryOut(**dict(row), prioritry_name=prioritry["name"] if prioritry else None)


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
        SELECT e.*, p.name AS prioritry_name
        FROM entry e
        JOIN prioritry p ON p.id = e.prioritry_id
        WHERE e.user_id = $1
          AND e.created_at >= $2
          AND e.created_at < $3
        ORDER BY e.created_at DESC
        """,
        uid, start_utc, end_utc,
    )
    return [EntryOut(**dict(r)) for r in rows]
