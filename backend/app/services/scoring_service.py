import asyncpg
from uuid import UUID
from decimal import Decimal
from datetime import date as date_type, date as date_cls
from app.utils.timezone import get_day_boundaries_utc, get_today_str
from app.models.scoring import DaySummary, DayPrioritrySummary, EntryBrief, TodoSummary, DeadlineSummary, BalanceOut


def to_uuid(user_id: str) -> UUID:
    return UUID(user_id) if isinstance(user_id, str) else user_id


def _deadline_score(point_value: int | None, due_date: date_cls | None, date_obj: date_cls, completed_at, start_utc, end_utc):
    """Compute score for a todo/task/project. Returns (score, is_upcoming).

    Completing it earns its points on the completion day, whenever that is.
    Until then it docks points every day from its due date onward; an item with
    no due date never docks, it just sits in the list.

    The penalty belongs to the day, not to the item: an item that was overdue on
    a given day stays overdue for that day forever, even once it is finally
    completed (which separately earns its points on the completion day). Without
    this, clearing a backlog item silently raised every past day it had been
    docking, so a day could never be recomputed to the value it was stored with.
    """
    pv = Decimal(point_value) if point_value else Decimal(0)
    if completed_at is not None and completed_at >= start_utc and completed_at < end_utc:
        return pv, False
    if due_date is None or due_date > date_obj:
        return Decimal(0), True
    # Overdue on this day. Callers skip items completed before it, so a non-null
    # completed_at here means it was finished on some later day — too late to
    # spare this one.
    return -pv, False


async def compute_day_score(user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection) -> DaySummary:
    """Compute the full day summary for a given date."""
    uid = to_uuid(user_id)
    start_utc, end_utc = get_day_boundaries_utc(date_str, tz_str)
    date_obj = date_cls.fromisoformat(date_str)

    # --- Goals & Bonuses ---
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
    entries = await conn.fetch(
        """
        SELECT e.id, e.prioritry_id, e.comment, e.created_at, e.quantity
        FROM entry e
        WHERE e.user_id = $1
          AND e.created_at >= $2
          AND e.created_at < $3
        ORDER BY e.created_at ASC
        """,
        uid, start_utc, end_utc,
    )
    entries_by_prioritry: dict[str, list[dict]] = {}
    for e in entries:
        pid = str(e["prioritry_id"])
        entries_by_prioritry.setdefault(pid, []).append(dict(e))

    goals = []
    bonuses = []
    for row in rows:
        pid = str(row["prioritry_id"])
        pri_entries = entries_by_prioritry.get(pid, [])
        # Units, not rows — one entry can carry several timeblocks.
        entry_count = sum(e["quantity"] for e in pri_entries)
        if row["type_name"] == "Goal":
            total_value = Decimal(row["point_value"]) * entry_count if entry_count > 0 else -Decimal(row["point_value"])
        else:
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
            entries=[
                EntryBrief(id=e["id"], comment=e["comment"], created_at=e["created_at"], quantity=e["quantity"])
                for e in pri_entries
            ],
        )
        if row["type_name"] == "Goal":
            goals.append(summary)
        else:
            bonuses.append(summary)

    goals_subtotal = sum(g.total_value for g in goals)
    bonuses_subtotal = sum(b.total_value for b in bonuses)

    # --- Todos ---
    todo_rows = await conn.fetch(
        """
        SELECT id, name, point_value, due_date, completed_at, created_at, comment
        FROM todo
        WHERE user_id = $1 AND created_at < $2
        ORDER BY created_at ASC
        """,
        uid, end_utc,
    )
    todos = []
    for t in todo_rows:
        completed_at = t["completed_at"]
        if completed_at is not None and completed_at < start_utc:
            continue
        score, is_upcoming = _deadline_score(
            t["point_value"], t["due_date"], date_obj, completed_at, start_utc, end_utc
        )
        todos.append(TodoSummary(
            id=t["id"], name=t["name"], point_value=t["point_value"],
            due_date=t["due_date"], completed_at=completed_at, created_at=t["created_at"],
            score=score, is_upcoming=is_upcoming, comment=t["comment"],
        ))
    todos_subtotal = sum(t.score for t in todos)

    # --- Projects ---
    # Fetch projects active on this day (not completed before today)
    project_rows = await conn.fetch(
        """
        SELECT id, name, point_value, due_date, completed_at, created_at
        FROM project
        WHERE user_id = $1
          AND created_at < $2
          AND (completed_at IS NULL OR completed_at >= $3)
        ORDER BY due_date ASC NULLS LAST
        """,
        uid, end_utc, start_utc,
    )

    deadlines = []
    rolling_score = Decimal(0)

    for p in project_rows:
        due_date = p["due_date"]
        completed_at = p["completed_at"]
        pv = p["point_value"]

        if due_date is None:
            # Rolling project — only scores if completed today
            if completed_at is not None and completed_at >= start_utc and completed_at < end_utc:
                rolling_score += Decimal(pv) if pv else Decimal(0)
            # Not shown in deadlines list
        else:
            score, is_upcoming = _deadline_score(pv, due_date, date_obj, completed_at, start_utc, end_utc)
            if completed_at is not None and completed_at < start_utc:
                continue  # already counted in a past day
            deadlines.append(DeadlineSummary(
                id=p["id"], type='project', name=p["name"],
                project_id=None, project_name=None,
                point_value=pv, due_date=due_date, created_at=p["created_at"],
                completed_at=completed_at, score=score, is_upcoming=is_upcoming,
            ))

    # --- Project Tasks ---
    task_rows = await conn.fetch(
        """
        SELECT pt.id, pt.name, pt.point_value, pt.due_date, pt.completed_at, pt.created_at, pt.comment,
               p.id AS project_id, p.name AS project_name
        FROM project_task pt
        JOIN project p ON p.id = pt.project_id
        WHERE pt.user_id = $1
          AND pt.created_at < $2
          AND (pt.completed_at IS NULL OR pt.completed_at >= $3)
        ORDER BY pt.due_date ASC NULLS LAST
        """,
        uid, end_utc, start_utc,
    )

    for t in task_rows:
        due_date = t["due_date"]
        completed_at = t["completed_at"]
        pv = t["point_value"]

        # Undated tasks are listed too — they never dock, they just earn on completion
        score, is_upcoming = _deadline_score(pv, due_date, date_obj, completed_at, start_utc, end_utc)
        if completed_at is not None and completed_at < start_utc:
            continue
        deadlines.append(DeadlineSummary(
            id=t["id"], type='task', name=t["name"],
            project_id=t["project_id"], project_name=t["project_name"],
            point_value=pv, due_date=due_date, created_at=t["created_at"],
            completed_at=completed_at, score=score, is_upcoming=is_upcoming,
            comment=t["comment"],
        ))

    # Sort combined deadlines by due_date ASC (overdue first, then upcoming, undated last)
    deadlines.sort(key=lambda d: (d.due_date is None, d.due_date or date_cls.max))
    deadlines_subtotal = sum(d.score for d in deadlines)

    return DaySummary(
        date=date_str,
        timezone=tz_str,
        goals=goals,
        bonuses=bonuses,
        todos=todos,
        deadlines=deadlines,
        goals_subtotal=goals_subtotal,
        bonuses_subtotal=bonuses_subtotal,
        todos_subtotal=todos_subtotal,
        deadlines_subtotal=deadlines_subtotal,
        daily_score=goals_subtotal + bonuses_subtotal + todos_subtotal + deadlines_subtotal + rolling_score,
    )


async def upsert_snapshot(user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection):
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
    uid = to_uuid(user_id)
    today_str = get_today_str(tz_str)
    await finalize_yesterday(user_id, tz_str, conn)
    past_total = await conn.fetchval(
        """
        SELECT COALESCE(SUM(score), 0)
        FROM daily_snapshot
        WHERE user_id = $1 AND date < $2
        """,
        uid, date_type.fromisoformat(today_str),
    )
    today_summary = await compute_day_score(user_id, today_str, tz_str, conn)
    return BalanceOut(
        past_total=past_total,
        today_score=today_summary.daily_score,
        current_balance=past_total + today_summary.daily_score,
    )
