import asyncpg
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app.models.spending import SpendCreate, SpendUpdate, SpendOut, SpendDayOut
from app.utils.timezone import get_day_boundaries_utc, get_today_str
from app.services.entry_service import to_uuid, parse_tags


async def _sync_tags(
    spend_id: UUID, user_id: UUID, comment: str | None, conn: asyncpg.Connection
) -> None:
    """Delete existing tags for a spend and re-insert from the current comment."""
    await conn.execute("DELETE FROM spend_tag WHERE spend_id = $1", spend_id)
    tags = parse_tags(comment)
    if tags:
        await conn.executemany(
            "INSERT INTO spend_tag (spend_id, user_id, tag) VALUES ($1, $2, $3)",
            [(spend_id, user_id, tag) for tag in tags],
        )


async def create_spend(
    user_id: str, data: SpendCreate, tz_str: str, conn: asyncpg.Connection
) -> SpendOut:
    uid = to_uuid(user_id)
    today_str = get_today_str(tz_str)

    # Backdated rows land at local noon so they can't drift across a day boundary.
    if data.target_date and data.target_date != today_str:
        tz = ZoneInfo(tz_str)
        created_at = datetime.strptime(data.target_date, "%Y-%m-%d").replace(
            hour=12, tzinfo=tz
        )
        row = await conn.fetchrow(
            """
            INSERT INTO spend (user_id, amount, comment, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            uid, data.amount, data.comment, created_at,
        )
    else:
        row = await conn.fetchrow(
            """
            INSERT INTO spend (user_id, amount, comment)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            uid, data.amount, data.comment,
        )

    await _sync_tags(row["id"], uid, data.comment, conn)
    return SpendOut(**dict(row))


async def update_spend(
    user_id: str, spend_id: UUID, data: SpendUpdate, conn: asyncpg.Connection
) -> SpendOut:
    uid = to_uuid(user_id)
    sent = data.model_fields_set

    sets: list[str] = []
    values: list = []
    if "amount" in sent:
        if data.amount is None:
            raise HTTPException(422, "amount cannot be null")
        values.append(data.amount)
        sets.append(f"amount = ${len(values)}")
    if "comment" in sent:
        values.append(data.comment)
        sets.append(f"comment = ${len(values)}")

    if not sets:
        row = await conn.fetchrow(
            "SELECT * FROM spend WHERE id = $1 AND user_id = $2", spend_id, uid
        )
        if not row:
            raise HTTPException(404, "Spend not found")
        return SpendOut(**dict(row))

    values.extend([spend_id, uid])
    row = await conn.fetchrow(
        f"""
        UPDATE spend SET {', '.join(sets)}
        WHERE id = ${len(values) - 1} AND user_id = ${len(values)}
        RETURNING *
        """,
        *values,
    )
    if not row:
        raise HTTPException(404, "Spend not found")

    if "comment" in sent:
        await _sync_tags(row["id"], uid, data.comment, conn)

    return SpendOut(**dict(row))


async def delete_spend(
    user_id: str, spend_id: UUID, conn: asyncpg.Connection
) -> dict:
    uid = to_uuid(user_id)
    deleted = await conn.fetchval(
        "DELETE FROM spend WHERE id = $1 AND user_id = $2 RETURNING id",
        spend_id, uid,
    )
    if not deleted:
        raise HTTPException(404, "Spend not found")
    return {"deleted": True}


async def list_spend_for_day(
    user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection
) -> SpendDayOut:
    uid = to_uuid(user_id)
    start_utc, end_utc = get_day_boundaries_utc(date_str, tz_str)
    rows = await conn.fetch(
        """
        SELECT * FROM spend
        WHERE user_id = $1
          AND created_at >= $2
          AND created_at < $3
        ORDER BY created_at DESC
        """,
        uid, start_utc, end_utc,
    )
    items = [SpendOut(**dict(r)) for r in rows]
    total = sum((i.amount for i in items), Decimal("0"))
    return SpendDayOut(items=items, total=total)
