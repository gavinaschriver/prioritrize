import asyncpg
from uuid import UUID
from app.models.dashboard import DashboardOut, PrioritryStats, TodoStats, TagStats
from app.utils.timezone import get_day_boundaries_utc


def to_uuid(user_id: str) -> UUID:
    return UUID(user_id) if isinstance(user_id, str) else user_id


async def get_dashboard(
    user_id: str,
    start_str: str,
    end_str: str,
    tz_str: str,
    conn: asyncpg.Connection,
) -> DashboardOut:
    uid = to_uuid(user_id)
    start_utc, _ = get_day_boundaries_utc(start_str, tz_str)
    _, end_utc = get_day_boundaries_utc(end_str, tz_str)

    # All active prioritries with entry counts in range
    rows = await conn.fetch(
        """
        SELECT
            p.id AS prioritry_id,
            p.name,
            t.name AS type_name,
            p.timeblock,
            COUNT(e.id) AS entry_count
        FROM prioritry p
        JOIN type t ON t.id = p.type_id
        LEFT JOIN entry e
            ON e.prioritry_id = p.id
            AND e.user_id = p.user_id
            AND e.created_at >= $2
            AND e.created_at < $3
        WHERE p.user_id = $1
          AND p.is_active = true
        GROUP BY p.id, p.name, t.name, p.timeblock
        ORDER BY t.name ASC, p.point_value DESC, p.name ASC
        """,
        uid, start_utc, end_utc,
    )

    prioritry_stats = []
    for row in rows:
        entry_count = int(row["entry_count"])
        timeblock = row["timeblock"]
        total_minutes = entry_count * timeblock if timeblock is not None else None
        prioritry_stats.append(PrioritryStats(
            prioritry_id=row["prioritry_id"],
            name=row["name"],
            type_name=row["type_name"],
            timeblock=timeblock,
            entry_count=entry_count,
            total_minutes=total_minutes,
        ))

    # Todos: all active (not completed before range), show if completed in range
    todo_rows = await conn.fetch(
        """
        SELECT id, name, completed_at
        FROM todo
        WHERE user_id = $1
          AND (completed_at IS NULL OR completed_at >= $2)
        ORDER BY created_at ASC
        """,
        uid, start_utc,
    )

    todo_stats = []
    for t in todo_rows:
        completed_at = t["completed_at"]
        completed_in_range = (
            completed_at is not None
            and completed_at >= start_utc
            and completed_at < end_utc
        )
        todo_stats.append(TodoStats(
            id=t["id"],
            name=t["name"],
            completed_in_range=completed_in_range,
        ))

    # Tag counts from entry_tag for the range
    tag_rows = await conn.fetch(
        """
        SELECT tag, COUNT(*) AS count
        FROM entry_tag
        WHERE user_id = $1
          AND created_at >= $2
          AND created_at < $3
        GROUP BY tag
        ORDER BY count DESC, tag ASC
        """,
        uid, start_utc, end_utc,
    )
    tag_stats = [TagStats(tag=r["tag"], count=int(r["count"])) for r in tag_rows]

    return DashboardOut(
        start=start_str,
        end=end_str,
        prioritry_stats=prioritry_stats,
        todo_stats=todo_stats,
        tag_stats=tag_stats,
    )
