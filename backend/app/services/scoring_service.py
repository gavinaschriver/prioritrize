import asyncpg
from uuid import UUID
from decimal import Decimal
from datetime import date as date_type
from app.utils.timezone import get_day_boundaries_utc, get_today_str
from app.models.scoring import DaySummary, DayPrioritrySummary, EntryBrief, BalanceOut


def to_uuid(user_id: str) -> UUID:
    return UUID(user_id) if isinstance(user_id, str) else user_id


async def compute_day_score(user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection) -> DaySummary:
    """Compute the full day summary for a given date."""
    uid = to_uuid(user_id)
    start_utc, end_utc = get_day_boundaries_utc(date_str, tz_str)

    rows = await conn.fetch(
        """
        SELECT
            p.id AS prioritry_id,
            p.name,
            p.point_value,
            p.can_repeat,
            p.comments_enabled,
            p.timeblock,
            t.name AS type_name
        FROM prioritry p
        JOIN type t ON t.id = p.type_id
        WHERE p.user_id = $1
          AND p.is_active = true
          AND p.created_at < $2
        ORDER BY t.name ASC, p.point_value DESC
        """,
        uid, end_utc,
    )

    # Get all entries for this day
    entries = await conn.fetch(
        """
        SELECT e.id, e.prioritry_id, e.comment, e.created_at
        FROM entry e
        WHERE e.user_id = $1
          AND e.created_at >= $2
          AND e.created_at < $3
        ORDER BY e.created_at ASC
        """,
        uid, start_utc, end_utc,
    )

    # Group entries by prioritry_id
    entries_by_prioritry: dict[str, list[dict]] = {}
    for e in entries:
        pid = str(e["prioritry_id"])
        entries_by_prioritry.setdefault(pid, []).append(dict(e))

    goals = []
    bonuses = []

    for row in rows:
        pid = str(row["prioritry_id"])
        pri_entries = entries_by_prioritry.get(pid, [])
        entry_count = len(pri_entries)

        if row["type_name"] == "Goal":
            if entry_count > 0:
                total_value = Decimal(row["point_value"]) * entry_count
            else:
                total_value = -Decimal(row["point_value"])
        else:  # Bonus
            total_value = Decimal(row["point_value"]) * entry_count if entry_count > 0 else Decimal(0)

        summary = DayPrioritrySummary(
            prioritry_id=row["prioritry_id"],
            name=row["name"],
            point_value=row["point_value"],
            can_repeat=row["can_repeat"],
            comments_enabled=row["comments_enabled"],
            timeblock=row["timeblock"],
            entry_count=entry_count,
            total_value=total_value,
            entries=[EntryBrief(id=e["id"], comment=e["comment"], created_at=e["created_at"]) for e in pri_entries],
        )

        if row["type_name"] == "Goal":
            goals.append(summary)
        else:
            bonuses.append(summary)

    goals_subtotal = sum(g.total_value for g in goals)
    bonuses_subtotal = sum(b.total_value for b in bonuses)

    return DaySummary(
        date=date_str,
        timezone=tz_str,
        goals=goals,
        bonuses=bonuses,
        goals_subtotal=goals_subtotal,
        bonuses_subtotal=bonuses_subtotal,
        daily_score=goals_subtotal + bonuses_subtotal,
    )


async def upsert_snapshot(user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection):
    """Compute and upsert the daily snapshot for a past day."""
    uid = to_uuid(user_id)
    summary = await compute_day_score(user_id, date_str, tz_str, conn)
    await conn.execute(
        """
        INSERT INTO daily_snapshot (user_id, date, score, computed_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (user_id, date)
        DO UPDATE SET score = $3, computed_at = now()
        """,
        uid, date_type.fromisoformat(date_str), summary.daily_score,
    )
    return summary.daily_score


async def finalize_yesterday(user_id: str, tz_str: str, conn: asyncpg.Connection):
    """Ensure yesterday's snapshot exists. Called on day summary access."""
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo

    uid = to_uuid(user_id)
    tz = ZoneInfo(tz_str)
    yesterday = (datetime.now(tz) - timedelta(days=1)).strftime("%Y-%m-%d")

    existing = await conn.fetchval(
        "SELECT id FROM daily_snapshot WHERE user_id = $1 AND date = $2",
        uid, date_type.fromisoformat(yesterday),
    )
    if not existing:
        await upsert_snapshot(user_id, yesterday, tz_str, conn)


async def get_balance(user_id: str, tz_str: str, conn: asyncpg.Connection) -> BalanceOut:
    """Get cumulative balance = sum of past snapshots + today's live score."""
    uid = to_uuid(user_id)
    today_str = get_today_str(tz_str)

    # Finalize yesterday if needed
    await finalize_yesterday(user_id, tz_str, conn)

    # Sum all past snapshots (excluding today)
    past_total = await conn.fetchval(
        """
        SELECT COALESCE(SUM(score), 0)
        FROM daily_snapshot
        WHERE user_id = $1 AND date < $2
        """,
        uid, date_type.fromisoformat(today_str),
    )

    # Compute today's live score
    today_summary = await compute_day_score(user_id, today_str, tz_str, conn)

    return BalanceOut(
        past_total=past_total,
        today_score=today_summary.daily_score,
        current_balance=past_total + today_summary.daily_score,
    )
