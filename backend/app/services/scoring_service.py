import asyncpg
import json
import logging
from uuid import UUID
from decimal import Decimal
from datetime import date as date_type, date as date_cls, timedelta
from zoneinfo import ZoneInfo
from app.utils.timezone import get_day_boundaries_utc, get_today_str
from app.models.scoring import DaySummary, DayPrioritrySummary, EntryBrief, TodoSummary, DeadlineSummary, BalanceOut, RecomputeOut

# Scoring semantics, recorded on every snapshot written.
#   1 — original. An overdue item's penalty was forgiven once it was completed on
#       a later day, so past days could never be recomputed to their stored value.
#   2 — the overdue penalty belongs to the day and survives a later completion.
#   3 — deferring a due-or-overdue item leaves a floor, so the days it was
#       already docking keep their penalty even once the due date has moved on.
SCORING_VERSION = 3

# Upper bound on how many days one backfill will compute, so a long-dormant
# account can't turn a single page load into hundreds of scoring passes.
BACKFILL_LIMIT_DAYS = 90

logger = logging.getLogger(__name__)


def to_uuid(user_id: str) -> UUID:
    return UUID(user_id) if isinstance(user_id, str) else user_id


def _effective_due(current_due: date_cls | None, floor_due: date_cls | None) -> date_cls | None:
    """The due date an item is judged against on a given day.

    Deferring an item that was already due or overdue leaves a floor: the date it
    held before the deferral. Scoring against the earlier of the two is what keeps
    the days it had already been docking, so pushing a date forward can no longer
    refund them. Days after the deferral see no floor and answer to the new date.
    """
    if floor_due is None:
        return current_due
    if current_due is None:
        return floor_due
    return min(current_due, floor_due)


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


async def fetch_due_floors(
    user_id: str, date_obj: date_cls, conn: asyncpg.Connection
) -> dict[tuple[str, UUID], date_cls]:
    """Due-date floors in force on one day, keyed by (item_type, item_id).

    A deferral recorded on or after the day being scored means the item still held
    its earlier due date on that day, so that is what the day answers to — the
    earliest of them, if it was deferred more than once, which is what makes a chain
    of deferrals compose without any special casing. Deferrals recorded before the
    day are already history: by then the item legitimately had its newer date.
    """
    uid = to_uuid(user_id)
    rows = await conn.fetch(
        """
        SELECT item_type, item_id, MIN(previous_due_date) AS floor_due
        FROM due_date_deferral
        WHERE user_id = $1 AND deferred_on >= $2
        GROUP BY item_type, item_id
        """,
        uid, date_obj,
    )
    return {(r["item_type"], r["item_id"]): r["floor_due"] for r in rows}


async def compute_day_score(user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection) -> DaySummary:
    """Compute the full day summary for a given date."""
    uid = to_uuid(user_id)
    start_utc, end_utc = get_day_boundaries_utc(date_str, tz_str)
    date_obj = date_cls.fromisoformat(date_str)
    # Due dates items were still being judged against on this day despite having
    # been deferred since. Empty for any day with no deferrals, which is most of them.
    due_floors = await fetch_due_floors(user_id, date_obj, conn)

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
        effective_due = _effective_due(t["due_date"], due_floors.get(("todo", t["id"])))
        score, is_upcoming = _deadline_score(
            t["point_value"], effective_due, date_obj, completed_at, start_utc, end_utc
        )
        todos.append(TodoSummary(
            id=t["id"], name=t["name"], point_value=t["point_value"],
            due_date=t["due_date"], completed_at=completed_at, created_at=t["created_at"],
            score=score, is_upcoming=is_upcoming, comment=t["comment"],
            effective_due_date=effective_due,
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
    rolling = []

    for p in project_rows:
        due_date = p["due_date"]
        completed_at = p["completed_at"]
        pv = p["point_value"]
        # Resolved before the rolling branch: a project whose due date was cleared
        # while it was overdue still owes those days, so it stays a deadline rather
        # than quietly becoming rolling and never docking again.
        effective_due = _effective_due(due_date, due_floors.get(("project", p["id"])))

        if effective_due is None:
            # Rolling project — only scores if completed today
            if completed_at is not None and completed_at >= start_utc and completed_at < end_utc:
                rolling.append(DeadlineSummary(
                    id=p["id"], type='project', name=p["name"],
                    project_id=None, project_name=None,
                    point_value=pv, due_date=None, created_at=p["created_at"],
                    completed_at=completed_at,
                    score=Decimal(pv) if pv else Decimal(0), is_upcoming=False,
                    effective_due_date=None,
                ))
            # Kept out of the deadlines list — it has no due date to sort by
        else:
            score, is_upcoming = _deadline_score(pv, effective_due, date_obj, completed_at, start_utc, end_utc)
            if completed_at is not None and completed_at < start_utc:
                continue  # already counted in a past day
            deadlines.append(DeadlineSummary(
                id=p["id"], type='project', name=p["name"],
                project_id=None, project_name=None,
                point_value=pv, due_date=due_date, created_at=p["created_at"],
                completed_at=completed_at, score=score, is_upcoming=is_upcoming,
                effective_due_date=effective_due,
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

        effective_due = _effective_due(due_date, due_floors.get(("task", t["id"])))
        # Undated tasks are listed too — they never dock, they just earn on completion
        score, is_upcoming = _deadline_score(pv, effective_due, date_obj, completed_at, start_utc, end_utc)
        if completed_at is not None and completed_at < start_utc:
            continue
        deadlines.append(DeadlineSummary(
            id=t["id"], type='task', name=t["name"],
            project_id=t["project_id"], project_name=t["project_name"],
            point_value=pv, due_date=due_date, created_at=t["created_at"],
            completed_at=completed_at, score=score, is_upcoming=is_upcoming,
            comment=t["comment"], effective_due_date=effective_due,
        ))

    # Sort combined deadlines by due_date ASC (overdue first, then upcoming, undated last)
    deadlines.sort(key=lambda d: (d.due_date is None, d.due_date or date_cls.max))
    deadlines_subtotal = sum(d.score for d in deadlines)
    rolling_subtotal = sum(r.score for r in rolling)

    return DaySummary(
        date=date_str,
        timezone=tz_str,
        goals=goals,
        bonuses=bonuses,
        todos=todos,
        deadlines=deadlines,
        rolling=rolling,
        goals_subtotal=goals_subtotal,
        bonuses_subtotal=bonuses_subtotal,
        todos_subtotal=todos_subtotal,
        deadlines_subtotal=deadlines_subtotal,
        rolling_subtotal=rolling_subtotal,
        daily_score=(
            goals_subtotal + bonuses_subtotal + todos_subtotal
            + deadlines_subtotal + rolling_subtotal
        ),
    )


def build_breakdown(summary: DaySummary) -> dict:
    """The per-line detail behind a day's score, frozen into daily_snapshot.

    Scoring reads prioritry.is_active, point_value, todo.due_date and completed_at
    live, and none of them are versioned, so a day recomputed later can legitimately
    differ from the day that was stored. Without a record of the inputs there is no
    way to tell that apart from a scoring bug — which is exactly the position the
    2026-08-14..19 snapshots left us in.

    Decimals are stored as strings so JSON round-trips them without going through
    a float. Only score-affecting lines are kept; items that were merely pending
    are omitted, since they contributed nothing.
    """
    def prioritry_line(p: DayPrioritrySummary) -> dict:
        return {
            "id": str(p.prioritry_id),
            "name": p.name,
            "point_value": p.point_value,
            "entry_count": p.entry_count,
            "value": str(p.total_value),
        }

    def item_line(i) -> dict:
        line = {
            "id": str(i.id),
            "name": i.name,
            "point_value": i.point_value,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "completed_at": i.completed_at.isoformat() if i.completed_at else None,
            "score": str(i.score),
        }
        # Present only when the two differ, i.e. this day was scored against a due
        # date the item no longer has because it was deferred out from under it.
        # Otherwise a locked penalty looks like an unexplained dock on a future item.
        if i.effective_due_date != i.due_date:
            line["effective_due_date"] = (
                i.effective_due_date.isoformat() if i.effective_due_date else None
            )
        return line

    return {
        # Shape of this document, independent of the scoring-semantics version
        # recorded in daily_snapshot.version.
        #   2 — item lines may carry effective_due_date.
        "schema": 2,
        "date": summary.date,
        "timezone": summary.timezone,
        "subtotals": {
            "goals": str(summary.goals_subtotal),
            "bonuses": str(summary.bonuses_subtotal),
            "todos": str(summary.todos_subtotal),
            "deadlines": str(summary.deadlines_subtotal),
            "rolling": str(summary.rolling_subtotal),
        },
        "goals_logged": [prioritry_line(g) for g in summary.goals if g.entry_count > 0],
        # The missed-goal penalties — usually the largest single driver of a
        # negative day, and the hardest thing to reconstruct after the fact.
        "goals_unlogged": [prioritry_line(g) for g in summary.goals if g.entry_count == 0],
        "bonuses": [prioritry_line(b) for b in summary.bonuses if b.entry_count > 0],
        "todos": [item_line(t) for t in summary.todos if t.score != 0],
        "deadlines": [item_line(d) for d in summary.deadlines if d.score != 0],
        "rolling": [item_line(r) for r in summary.rolling],
        "daily_score": str(summary.daily_score),
    }


async def upsert_snapshot(
    user_id: str,
    date_str: str,
    tz_str: str,
    conn: asyncpg.Connection,
    force: bool = False,
):
    """Write (or refresh) one day's cached score.

    A finalized day is immutable: this returns the stored score untouched unless
    called with force=True. That is what makes the backfill idempotent — re-running
    it can only fill gaps, never rewrite history — and it means every overwrite of a
    closed day is an explicit decision made by a caller that knows the inputs moved.
    """
    uid = to_uuid(user_id)
    day = date_type.fromisoformat(date_str)

    existing = await conn.fetchrow(
        "SELECT score, finalized FROM daily_snapshot WHERE user_id = $1 AND date = $2",
        uid, day,
    )
    if existing and existing["finalized"] and not force:
        return existing["score"]

    summary = await compute_day_score(user_id, date_str, tz_str, conn)
    # A day is closed once it is no longer the user's today.
    finalized = day < date_type.fromisoformat(get_today_str(tz_str))

    await conn.execute(
        """
        INSERT INTO daily_snapshot
            (user_id, date, score, breakdown, timezone, version, finalized, computed_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, now())
        ON CONFLICT (user_id, date)
        DO UPDATE SET
            score = $3, breakdown = $4::jsonb, timezone = $5,
            version = $6, finalized = $7, computed_at = now()
        """,
        uid, day, summary.daily_score,
        json.dumps(build_breakdown(summary)), tz_str,
        SCORING_VERSION, finalized,
    )
    return summary.daily_score


async def find_unsnapshotted_days(
    user_id: str, tz_str: str, conn: asyncpg.Connection
) -> list[date_type]:
    """Every closed day from the user's first entry to yesterday that has no
    usable snapshot, oldest first.

    Holes are not only at the end. 2026-05-24 and 2026-06-10 both sit well before
    the newest snapshot, so walking forward from max(date) would never reach them.
    The whole active range has to be scanned.

    A row that exists but is still marked unfinalized counts as missing too: it was
    written while that day was in progress and never closed out.
    """
    uid = to_uuid(user_id)
    yesterday = date_type.fromisoformat(get_today_str(tz_str)) - timedelta(days=1)

    first_active = await conn.fetchval(
        "SELECT min((created_at AT TIME ZONE $2)::date) FROM entry WHERE user_id = $1",
        uid, tz_str,
    )
    if first_active is None or first_active > yesterday:
        return []

    # Offsets rather than generate_series over dates: generate_series on a date
    # yields timestamptz, and casting that back to date would silently go through
    # the session timezone instead of the user's.
    rows = await conn.fetch(
        """
        SELECT ($2::date + i) AS day
        FROM generate_series(0, ($3::date - $2::date)) i
        LEFT JOIN daily_snapshot s
          ON s.user_id = $1 AND s.date = $2::date + i
        WHERE s.id IS NULL OR s.finalized = false
        ORDER BY i
        """,
        uid, first_active, yesterday,
    )
    return [r["day"] for r in rows]


async def backfill_snapshots(
    user_id: str, tz_str: str, conn: asyncpg.Connection
) -> list[date_type]:
    """Fill in every missing past-day snapshot. Returns the days written.

    Replaces finalize_yesterday, which only ever considered yesterday and gave up
    if a row already existed. Any day the app wasn't opened for got no row at all,
    and get_balance sums only the rows that exist — so those days counted as zero,
    losing both their earned points and their missed-goal penalties.

    Idempotent: upsert_snapshot won't touch a finalized day without force, so
    re-running this can only fill gaps, never rewrite history.
    """
    days = await find_unsnapshotted_days(user_id, tz_str, conn)
    if not days:
        return []

    if len(days) > BACKFILL_LIMIT_DAYS:
        # Keep the most recent — that's what the user is actually looking at.
        # Say so rather than truncating silently, or the balance is quietly wrong.
        skipped = days[:-BACKFILL_LIMIT_DAYS]
        days = days[-BACKFILL_LIMIT_DAYS:]
        logger.warning(
            "backfill capped at %d days for user %s; %d older days left "
            "unsnapshotted (%s..%s) and excluded from the balance",
            BACKFILL_LIMIT_DAYS, user_id, len(skipped),
            skipped[0].isoformat(), skipped[-1].isoformat(),
        )

    for day in days:
        await upsert_snapshot(user_id, day.isoformat(), tz_str, conn)

    logger.info("backfilled %d snapshot(s) for user %s", len(days), user_id)
    return days


def earliest_affected_day(
    tz_str: str, due_dates=(), timestamps=()
) -> date_type | None:
    """The first local day a todo/task/project change could have altered.

    A due date is already a local calendar date; a completed_at is an instant that
    has to be resolved in the user's zone first. Returns None when the item has
    neither, in which case it never scored on any past day.
    """
    tz = ZoneInfo(tz_str)
    days = [d for d in due_dates if d is not None]
    days += [t.astimezone(tz).date() for t in timestamps if t is not None]
    return min(days) if days else None


async def rescore_from(
    user_id: str, start_day: date_type | None, tz_str: str, conn: asyncpg.Connection
) -> list[date_type]:
    """Force-rescore every closed day from start_day through yesterday.

    Called when a todo, task or project changes in a way that alters what past days
    were worth: a due date moving, an item being deleted, a completion being undone.
    The range matters because an overdue item docks points on *every* day it stayed
    open, so removing or re-dating one moves all of them, not just one.

    Completing something is deliberately not in that set. Since scoring version 2 an
    overdue penalty belongs to the day it was incurred, so finishing an item late
    only affects the day it was finished — which is today, and today isn't snapshotted.
    """
    if start_day is None:
        return []

    yesterday = date_type.fromisoformat(get_today_str(tz_str)) - timedelta(days=1)
    if start_day > yesterday:
        return []

    span = (yesterday - start_day).days + 1
    if span > BACKFILL_LIMIT_DAYS:
        capped = yesterday - timedelta(days=BACKFILL_LIMIT_DAYS - 1)
        logger.warning(
            "rescore for user %s capped at %d days; %s..%s left stale",
            user_id, BACKFILL_LIMIT_DAYS, start_day.isoformat(),
            (capped - timedelta(days=1)).isoformat(),
        )
        start_day = capped

    days = [
        start_day + timedelta(days=i)
        for i in range((yesterday - start_day).days + 1)
    ]
    for day in days:
        await upsert_snapshot(user_id, day.isoformat(), tz_str, conn, force=True)
    return days


async def record_deferral(
    conn: asyncpg.Connection,
    user_id: str,
    item_type: str,
    item_id: UUID,
    before_row,
    new_due: date_type | None,
    tz_str: str,
) -> bool:
    """Log a procrastination event, if that is what this due-date change was.

    Only a deferral qualifies: the item was still open, was already due or overdue,
    and its date moved later or was cleared outright. Clearing it is the open-ended
    version of the same choice — the delay was taken either way, the user is just
    not naming a new date — so it locks the penalty too.

    Deleting an item is deliberately not a deferral. That is a "won't do": the work
    stopped existing rather than being put off, and no delay was bought.

    Pulling a date earlier, dating something that never had a due date, and editing
    one that is not due yet are all left alone — none of them avoids work already owed.

    Must be called before rescore_from, or the rescore recomputes those days without
    the floor and erases the very penalty this is recording.
    """
    previous_due = before_row["due_date"]
    if before_row["completed_at"] is not None or previous_due is None:
        return False
    today = date_type.fromisoformat(get_today_str(tz_str))
    if previous_due > today:
        return False
    if new_due is not None and new_due <= previous_due:
        return False

    await conn.execute(
        """
        INSERT INTO due_date_deferral
            (user_id, item_type, item_id, previous_due_date, new_due_date, deferred_on)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        to_uuid(user_id), item_type, item_id, previous_due, new_due, today,
    )
    logger.info(
        "deferral: user %s moved %s %s from %s to %s on %s",
        user_id, item_type, item_id, previous_due, new_due, today,
    )
    return True


def _loaded_breakdown(value) -> dict | None:
    """asyncpg hands jsonb back as text unless a codec is registered."""
    if value is None:
        return None
    return json.loads(value) if isinstance(value, str) else value


async def recompute_day(
    user_id: str, date_str: str, tz_str: str, conn: asyncpg.Connection
) -> RecomputeOut:
    """Rescore one day and report what moved.

    This is the only sanctioned way to overwrite a finalized snapshot. Everything
    else treats closed days as immutable, so if a score changes here it is because
    a caller asked for it — and the two breakdowns show exactly what differed.
    """
    uid = to_uuid(user_id)
    day = date_type.fromisoformat(date_str)

    before = await conn.fetchrow(
        """
        SELECT score, breakdown, version, computed_at
        FROM daily_snapshot WHERE user_id = $1 AND date = $2
        """,
        uid, day,
    )
    new_score = await upsert_snapshot(user_id, date_str, tz_str, conn, force=True)
    after = await conn.fetchrow(
        "SELECT breakdown FROM daily_snapshot WHERE user_id = $1 AND date = $2",
        uid, day,
    )

    previous_score = before["score"] if before else None
    return RecomputeOut(
        date=date_str,
        timezone=tz_str,
        previous_score=previous_score,
        new_score=new_score,
        delta=None if previous_score is None else new_score - previous_score,
        previous_version=before["version"] if before else None,
        previous_computed_at=before["computed_at"] if before else None,
        previous_breakdown=_loaded_breakdown(before["breakdown"]) if before else None,
        breakdown=_loaded_breakdown(after["breakdown"]),
    )


async def get_balance(user_id: str, tz_str: str, conn: asyncpg.Connection) -> BalanceOut:
    uid = to_uuid(user_id)
    today_str = get_today_str(tz_str)
    await backfill_snapshots(user_id, tz_str, conn)
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
