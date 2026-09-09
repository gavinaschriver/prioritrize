import asyncpg
import logging
from datetime import date as date_cls, timedelta
from uuid import UUID
from fastapi import HTTPException

from app.models.item_template import TemplateCreate, TemplateUpdate, TemplateOut
from app.models.todo import TodoCreate, TodoOut
from app.models.project import ProjectTaskCreate, ProjectTaskOut
from app.services import category_service, todo_service, project_service
from app.utils.timezone import get_today_str

logger = logging.getLogger(__name__)


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


_COLS = (
    "id, user_id, kind, project_id, name, point_value, description, category_id, "
    "repeat_every_days, starts_on, ends_on, paused, last_materialized_on, "
    "created_at, updated_at"
)


def next_occurrence(t: TemplateOut, today: date_cls) -> date_cls | None:
    """The next date this schedule should produce something. Never in the past.

    Forward-looking on purpose. A recurring todo behaves like a calendar event: you
    want Friday's trash on the calendar on Wednesday, not to discover it on Friday.
    So a template created today with a start date on Saturday produces its Saturday
    instance immediately, dated Saturday -- it scores nothing until then, it just
    sits in the queue as upcoming, exactly like any hand-typed todo with a future
    due date.

    Two floors, and between them they are the entire catch-up policy:

    - Never earlier than today, so a fortnight away owes you the next trash-taking
      rather than two overdue ones. Missed occurrences are not a debt, and they are
      skipped here by never being candidates in the first place.
    - Never at or before last_materialized_on, so finishing an occurrence rolls the
      series on to the following one instead of re-making the one just completed.

    Returns None when the series has no interval, no anchor, or has run past ends_on.
    """
    start = t.starts_on
    if t.repeat_every_days is None or start is None:
        return None

    n = t.repeat_every_days
    floor = today
    if t.last_materialized_on is not None:
        floor = max(floor, t.last_materialized_on + timedelta(days=1))

    if floor <= start:
        occurrence = start
    else:
        # Smallest k with start + k*n >= floor. Negating the floor division is how
        # Python spells ceiling division on integers.
        steps = -((start - floor).days // n)
        occurrence = start + timedelta(days=steps * n)

    if t.ends_on is not None and occurrence > t.ends_on:
        return None
    return occurrence


async def _fetch_owned(conn: asyncpg.Connection, template_id: UUID, uid: UUID):
    """The API connects as the table owner, so RLS is not filtering for us --
    every read has to prove ownership itself. Same reasoning as
    category_service.assert_owned."""
    row = await conn.fetchrow(
        f"SELECT {_COLS} FROM item_template WHERE id = $1 AND user_id = $2",
        template_id, uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    return row


async def _assert_project_owned(conn: asyncpg.Connection, project_id, uid: UUID) -> None:
    if project_id is None:
        return
    owned = await conn.fetchval(
        "SELECT 1 FROM project WHERE id = $1 AND user_id = $2",
        to_uuid(project_id), uid,
    )
    if not owned:
        raise HTTPException(status_code=404, detail="Project not found")


async def list_templates(
    conn: asyncpg.Connection, user_id: str,
    kind: str | None = None, project_id: UUID | None = None,
) -> list[TemplateOut]:
    uid = to_uuid(user_id)
    rows = await conn.fetch(
        f"""
        SELECT {_COLS} FROM item_template
        WHERE user_id = $1
          AND ($2::text IS NULL OR kind = $2)
          AND ($3::uuid IS NULL OR project_id = $3)
        ORDER BY lower(name) ASC
        """,
        uid, kind, project_id,
    )
    return [TemplateOut(**dict(r)) for r in rows]


async def create_template(
    conn: asyncpg.Connection, user_id: str, data: TemplateCreate, tz_str: str = "UTC",
) -> TemplateOut:
    uid = to_uuid(user_id)
    await category_service.assert_owned(conn, data.category_id, uid)
    await _assert_project_owned(conn, data.project_id, uid)

    # A recurring template always gets an anchor date. Left to default, "every
    # other Monday" would have to count from created_at, which is a UTC instant and
    # can land on the wrong local day. Stamping the user's today here means the
    # schedule counts from a date they'd recognise.
    starts_on = data.starts_on
    if starts_on is None and data.repeat_every_days is not None:
        starts_on = date_cls.fromisoformat(get_today_str(tz_str))

    row = await conn.fetchrow(
        f"""
        INSERT INTO item_template (
            user_id, kind, project_id, name, point_value, description, category_id,
            repeat_every_days, starts_on, ends_on
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING {_COLS}
        """,
        uid, data.kind, data.project_id, data.name, data.point_value, data.description,
        data.category_id, data.repeat_every_days, starts_on, data.ends_on,
    )
    if data.repeat_every_days is not None:
        # A schedule you can't see hasn't obviously been created. Spinning the first
        # occurrence up now means saving "every Saturday" on a Wednesday puts
        # Saturday's todo in the queue immediately, dated Saturday -- the way adding
        # a recurring calendar event shows you the next one straight away.
        await materialize_due_recurrences(conn, user_id, tz_str)
        # Re-read: the line above stamps last_materialized_on on the row just made.
        row = await _fetch_owned(conn, row["id"], uid)
    return TemplateOut(**dict(row))


async def update_template(
    conn: asyncpg.Connection, template_id: UUID, user_id: str, data: TemplateUpdate,
) -> TemplateOut:
    uid = to_uuid(user_id)
    before = await _fetch_owned(conn, template_id, uid)

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return TemplateOut(**dict(before))
    if "category_id" in updates:
        await category_service.assert_owned(conn, updates["category_id"], uid)

    set_clauses = ", ".join(f"{k} = ${i + 3}" for i, k in enumerate(updates))
    row = await conn.fetchrow(
        f"""
        UPDATE item_template SET {set_clauses}, updated_at = now()
        WHERE id = $1 AND user_id = $2 RETURNING {_COLS}
        """,
        template_id, uid, *updates.values(),
    )
    return TemplateOut(**dict(row))


async def delete_template(conn: asyncpg.Connection, template_id: UUID, user_id: str) -> dict:
    uid = to_uuid(user_id)
    await _fetch_owned(conn, template_id, uid)
    # todo.template_id is ON DELETE SET NULL, so the instances this produced stay
    # exactly where they are -- retiring a blueprint must never delete real work.
    await conn.execute(
        "DELETE FROM item_template WHERE id = $1 AND user_id = $2", template_id, uid,
    )
    return {"ok": True}


async def _build_todo(
    conn: asyncpg.Connection, user_id: str, t: TemplateOut, due_date: date_cls | None,
) -> TodoOut:
    """Make one real todo from a blueprint.

    Goes through todo_service.create_todo rather than its own INSERT so the
    instance is indistinguishable from a hand-typed one: same ownership checks,
    same #NNNN out of ref_counter, same everything scoring reads.
    """
    todo = await todo_service.create_todo(conn, user_id, TodoCreate(
        name=t.name,
        point_value=t.point_value,
        due_date=due_date,
        description=t.description,
        category_id=t.category_id,
    ))
    # Stamped after the fact rather than threaded through TodoCreate: this is
    # provenance, not something a client should ever be able to set. It is also how
    # the generator knows an occurrence is still open.
    await conn.execute("UPDATE todo SET template_id = $2 WHERE id = $1", todo.id, t.id)
    return todo


async def instantiate(
    conn: asyncpg.Connection, user_id: str, template_id: UUID, due_date: date_cls | None,
) -> TodoOut | ProjectTaskOut:
    uid = to_uuid(user_id)
    t = TemplateOut(**dict(await _fetch_owned(conn, template_id, uid)))

    if t.kind == "task":
        return await project_service.create_task(conn, t.project_id, user_id, ProjectTaskCreate(
            name=t.name,
            point_value=t.point_value,
            due_date=due_date,
            description=t.description,
        ))
    return await _build_todo(conn, user_id, t, due_date)


async def materialize_due_recurrences(
    conn: asyncpg.Connection, user_id: str, tz_str: str,
) -> list[UUID]:
    """Make sure every live schedule has its next occurrence sitting in the queue.

    Called on every day-summary load, and again whenever a schedule is created, in
    the same spirit as scoring_service.backfill_snapshots: there is no cron anywhere
    in this app, and a server-side one would be worse than none, because only a
    request knows the user's timezone. So the work happens when someone looks.

    The rule is one open occurrence per series. While one is open nothing is made,
    so the queue never fills with identical rows and an unfinished chore simply goes
    overdue. The moment it is completed, the following occurrence appears -- which
    is what makes a recurring todo read like a calendar entry rather than something
    that ambushes you on the day.

    Idempotent: last_materialized_on plus the open-instance check mean re-running
    can only ever fill a gap.

    Safe for past days by construction: everything created here has
    created_at = now(), and compute_day_score only counts todos with
    created_at < the day's end, so a finalized day cannot be altered from here.
    """
    uid = to_uuid(user_id)
    today = date_cls.fromisoformat(get_today_str(tz_str))
    rows = await conn.fetch(
        f"""
        SELECT {_COLS} FROM item_template
        WHERE user_id = $1 AND repeat_every_days IS NOT NULL AND paused = false
        """,
        uid,
    )

    created: list[UUID] = []
    for row in rows:
        t = TemplateOut(**dict(row))

        still_open = await conn.fetchval(
            """
            SELECT 1 FROM todo
            WHERE template_id = $1 AND user_id = $2 AND completed_at IS NULL
            LIMIT 1
            """,
            t.id, uid,
        )
        if still_open:
            continue

        occurrence = next_occurrence(t, today)
        if occurrence is None:
            continue

        todo = await _build_todo(conn, user_id, t, occurrence)
        created.append(todo.id)
        await conn.execute(
            "UPDATE item_template SET last_materialized_on = $2, updated_at = now() WHERE id = $1",
            t.id, occurrence,
        )

    if created:
        logger.info("materialized %d recurring todo(s) for user %s", len(created), user_id)
    return created
