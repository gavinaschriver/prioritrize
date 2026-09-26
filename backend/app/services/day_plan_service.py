import asyncpg
from collections import Counter
from datetime import date
from uuid import UUID
from fastapi import HTTPException
from app.models.day_plan import (
    DayPlanOut, PlanBlock, PlanCandidate, PlanItemCreate, PlanItemMove, SlotRemove, UNSLOTTED,
)
from app.utils.timezone import get_today_str


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


# Placements for one day, joined to whatever they point at. The WHERE clause does
# the two kinds of disappearing:
#   - a placement whose item was deleted (or whose daily was deactivated) drops out;
#   - an item completed on an EARLIER day drops out, so a thing planned for Sunday
#     and finished Friday doesn't haunt Sunday. Completed on the plan date itself,
#     it stays and renders struck through.
_PLACEMENTS_SQL = """
SELECT d.id, d.section, d.slot_index, d.entity_type, d.entity_id,
       COALESCE(t.name, pt.name, p.name, d.freeform_text, '') AS name,
       COALESCE(t.point_value, pt.point_value, p.point_value) AS point_value,
       COALESCE(t.ref_number, pt.ref_number) AS ref_number,
       COALESCE(t.due_date, pt.due_date) AS due_date,
       COALESCE(t.completed_at, pt.completed_at) AS completed_at,
       pt.project_id, pr.name AS project_name, ty.name AS daily_type,
       COALESCE(p.can_repeat, false) AS can_repeat,
       (p.id IS NOT NULL AND EXISTS (
           SELECT 1 FROM entry e
           WHERE e.prioritry_id = p.id
             AND (e.created_at AT TIME ZONE $3)::date = $2
       )) AS logged
FROM day_plan_item d
LEFT JOIN todo t
       ON d.entity_type = 'todo' AND t.id = d.entity_id AND t.user_id = d.user_id
LEFT JOIN project_task pt
       ON d.entity_type = 'project_task' AND pt.id = d.entity_id AND pt.user_id = d.user_id
LEFT JOIN project pr ON pr.id = pt.project_id
LEFT JOIN prioritry p
       ON d.entity_type = 'prioritry' AND p.id = d.entity_id AND p.user_id = d.user_id
      AND p.is_active AND NOT p.hide_from_day_view
LEFT JOIN type ty ON ty.id = p.type_id
WHERE d.user_id = $1 AND d.plan_date = $2
  AND (d.entity_type = 'freeform' OR COALESCE(t.id, pt.id, p.id) IS NOT NULL)
  AND (COALESCE(t.completed_at, pt.completed_at) IS NULL
       OR (COALESCE(t.completed_at, pt.completed_at) AT TIME ZONE $3)::date >= $2)
"""

# Pending todos and tasks, oldest due first, undated last -- the same order as the
# tracker's hybrid view. `due_cutoff` narrows it to "due by this date" for the bank;
# NULL means everything, for "+ Other".
_PENDING_SQL = """
SELECT 'todo' AS entity_type, t.id AS entity_id, t.name, t.point_value, t.ref_number,
       t.due_date, NULL::uuid AS project_id, NULL::text AS project_name, t.created_at
FROM todo t
WHERE t.user_id = $1 AND t.completed_at IS NULL
  AND ($2::date IS NULL OR (t.due_date <= $2 AND ($3 OR t.due_date = $2)))
UNION ALL
SELECT 'project_task', pt.id, pt.name, pt.point_value, pt.ref_number,
       pt.due_date, pt.project_id, pr.name, pt.created_at
FROM project_task pt
JOIN project pr ON pr.id = pt.project_id
WHERE pt.user_id = $1 AND pt.completed_at IS NULL
  AND ($2::date IS NULL OR (pt.due_date <= $2 AND ($3 OR pt.due_date = $2)))
ORDER BY due_date ASC NULLS LAST, created_at ASC
"""


DEFAULT_SLOT_COUNT = 3
TIMELINE = ("morning", "afternoon", "evening")

# A section's real slot count: what's stored (3 if nothing is), but never fewer
# than the highest occupied slot + 1 -- a stale count must not hide a block.
_EFFECTIVE_COUNT_SQL = f"""
SELECT GREATEST(
    COALESCE((SELECT slot_count FROM day_plan_section
              WHERE user_id = $1 AND plan_date = $2 AND section = $3), {DEFAULT_SLOT_COUNT}),
    COALESCE((SELECT MAX(slot_index) + 1 FROM day_plan_item
              WHERE user_id = $1 AND plan_date = $2 AND section = $3), 0)
)
"""


async def _set_slot_count(conn: asyncpg.Connection, uid: UUID, plan_date: date, section: str, count: int) -> None:
    await conn.execute(
        """
        INSERT INTO day_plan_section (user_id, plan_date, section, slot_count)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, plan_date, section)
            DO UPDATE SET slot_count = $4, updated_at = now()
        """,
        uid, plan_date, section, count,
    )


async def _grow_to_fit(conn: asyncpg.Connection, uid: UUID, plan_date: date, section: str, slot_index: int | None) -> None:
    """A drop past the last slot adds a slot. Store it, so moving the block back
    out later leaves an empty slot behind rather than making it vanish."""
    if section not in TIMELINE or slot_index is None:
        return
    current = await conn.fetchval(_EFFECTIVE_COUNT_SQL, uid, plan_date, section)
    await _set_slot_count(conn, uid, plan_date, section, max(current, slot_index + 1))


async def get_day_plan(conn: asyncpg.Connection, user_id: str, plan_date: date, tz_str: str) -> DayPlanOut:
    uid = to_uuid(user_id)
    is_today = plan_date.isoformat() == get_today_str(tz_str)

    placed_rows = await conn.fetch(_PLACEMENTS_SQL, uid, plan_date, tz_str)
    placed = [PlanBlock(**dict(r)) for r in placed_rows]
    placed_keys = {(b.entity_type, b.entity_id) for b in placed}

    # Overdue work only rides along on today -- a future day's bank is just what
    # falls due that day.
    due_rows = await conn.fetch(_PENDING_SQL, uid, plan_date, is_today)
    derived = [
        PlanBlock(id=None, section="bank", slot_index=None, completed_at=None,
                  **{k: v for k, v in dict(r).items() if k != "created_at"})
        for r in due_rows
        if (r["entity_type"], r["entity_id"]) not in placed_keys
    ]

    daily_rows = await conn.fetch(
        """
        SELECT p.id AS entity_id, p.name, p.point_value, ty.name AS daily_type, p.can_repeat,
               EXISTS (
                   SELECT 1 FROM entry e
                   WHERE e.prioritry_id = p.id
                     AND (e.created_at AT TIME ZONE $3)::date = $2
               ) AS logged
        FROM prioritry p
        JOIN type ty ON ty.id = p.type_id
        WHERE p.user_id = $1 AND p.is_active AND NOT p.hide_from_day_view
        ORDER BY p.name
        """,
        uid, plan_date, tz_str,
    )
    # A repeatable daily stays in the drawer however many sessions are slotted,
    # carrying the count so the UI can mark it "already scheduled". A one-off
    # daily leaves the drawer once it's placed anywhere.
    sessions = Counter(
        b.entity_id for b in placed if b.entity_type == "prioritry" and b.section in TIMELINE
    )
    dismissed_keys = {(b.entity_type, b.entity_id) for b in placed if b.section == "dismissed"}
    dailies = [
        PlanBlock(id=None, section="bank", slot_index=None, entity_type="prioritry",
                  ref_number=None, due_date=None, completed_at=None,
                  project_id=None, project_name=None,
                  scheduled_count=sessions[r["entity_id"]] if r["can_repeat"] else 0,
                  **dict(r))
        for r in daily_rows
        if (r["can_repeat"] and ("prioritry", r["entity_id"]) not in dismissed_keys)
        or (not r["can_repeat"] and ("prioritry", r["entity_id"]) not in placed_keys)
    ]

    counts = {s: await conn.fetchval(_EFFECTIVE_COUNT_SQL, uid, plan_date, s) for s in TIMELINE}

    # A daily only has a bank row if it was moved there; it still belongs in the
    # dailies panel, not among the day's due work.
    banked = [b for b in placed if b.section == "bank"]
    return DayPlanOut(
        date=plan_date,
        slot_counts=counts,
        bank=[b for b in banked if b.entity_type != "prioritry"] + derived,
        # A repeatable daily's drawer copy is always the derived one above, so a
        # stray bank row for it would only be a duplicate.
        dailies=[b for b in banked if b.entity_type == "prioritry" and not b.can_repeat] + dailies,
        slots=[b for b in placed if b.section not in UNSLOTTED],
        dismissed=[b for b in placed if b.section == "dismissed"],
    )


async def get_candidates(conn: asyncpg.Connection, user_id: str, plan_date: date, tz_str: str) -> list[PlanCandidate]:
    """Everything pending that isn't already on this day, in either the bank or a slot."""
    plan = await get_day_plan(conn, user_id, plan_date, tz_str)
    on_the_day = {(b.entity_type, b.entity_id) for b in plan.bank + plan.slots}

    rows = await conn.fetch(_PENDING_SQL, to_uuid(user_id), None, False)
    return [
        PlanCandidate(**{k: v for k, v in dict(r).items() if k not in ("created_at", "project_id")})
        for r in rows
        if (r["entity_type"], r["entity_id"]) not in on_the_day
    ]


_OWNER_SQL = {
    "todo": "SELECT 1 FROM todo WHERE id = $1 AND user_id = $2",
    "project_task": "SELECT 1 FROM project_task WHERE id = $1 AND user_id = $2",
    "prioritry": "SELECT 1 FROM prioritry WHERE id = $1 AND user_id = $2",
}


async def create_item(conn: asyncpg.Connection, user_id: str, data: PlanItemCreate) -> dict:
    uid = to_uuid(user_id)
    if data.entity_type != "freeform":
        if not await conn.fetchval(_OWNER_SQL[data.entity_type], data.entity_id, uid):
            raise HTTPException(404, "That item isn't yours")

    # The unique index exempts dailies so repeatable ones can take several slots;
    # a one-off daily is held to one placement here instead.
    if data.entity_type == "prioritry":
        can_repeat = await conn.fetchval("SELECT can_repeat FROM prioritry WHERE id = $1", data.entity_id)
        if not can_repeat and await conn.fetchval(
            """
            SELECT 1 FROM day_plan_item
            WHERE user_id = $1 AND plan_date = $2 AND entity_type = 'prioritry' AND entity_id = $3
            """,
            uid, data.plan_date, data.entity_id,
        ):
            raise HTTPException(409, "That daily is already on this day")

    try:
        row = await conn.fetchrow(
            """
            INSERT INTO day_plan_item
                (user_id, plan_date, section, slot_index, entity_type, entity_id, freeform_text)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            """,
            uid, data.plan_date, data.section, data.slot_index,
            data.entity_type, data.entity_id, data.freeform_text,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "That slot is taken, or the item is already on this day")
    await _grow_to_fit(conn, uid, data.plan_date, data.section, data.slot_index)
    return {"id": row["id"]}


async def move_item(conn: asyncpg.Connection, user_id: str, item_id: UUID, data: PlanItemMove) -> dict:
    """Move a stored block. If the target slot holds another block, the two trade places."""
    uid = to_uuid(user_id)
    async with conn.transaction():
        mover = await conn.fetchrow(
            "SELECT * FROM day_plan_item WHERE id = $1 AND user_id = $2 FOR UPDATE",
            item_id, uid,
        )
        if not mover:
            raise HTTPException(404, "Plan item not found")
        if data.section in UNSLOTTED and mover["entity_type"] == "freeform":
            raise HTTPException(400, "Freeform blocks can't go in the bank")

        occupant = None
        if data.section not in UNSLOTTED:
            occupant = await conn.fetchrow(
                """
                SELECT * FROM day_plan_item
                WHERE user_id = $1 AND plan_date = $2 AND section = $3 AND slot_index = $4
                  AND id <> $5
                FOR UPDATE
                """,
                uid, mover["plan_date"], data.section, data.slot_index, item_id,
            )
        if occupant and mover["section"] in UNSLOTTED and occupant["entity_type"] == "freeform":
            raise HTTPException(409, "Can't swap a freeform block into the bank")

        # Leaving a slot keeps it (it just goes empty). Pin the source section's
        # count while the mover still sits there, or a block that was holding the
        # count up would take its slot with it.
        await _grow_to_fit(conn, uid, mover["plan_date"], mover["section"], mover["slot_index"])

        # Mid-swap, both blocks briefly claim the same slot; check at commit instead.
        await conn.execute("SET CONSTRAINTS day_plan_item_one_per_slot DEFERRED")
        await conn.execute(
            "UPDATE day_plan_item SET section = $2, slot_index = $3, updated_at = now() WHERE id = $1",
            item_id, data.section, data.slot_index,
        )
        if occupant:
            await conn.execute(
                "UPDATE day_plan_item SET section = $2, slot_index = $3, updated_at = now() WHERE id = $1",
                occupant["id"], mover["section"], mover["slot_index"],
            )
        await _grow_to_fit(conn, uid, mover["plan_date"], data.section, data.slot_index)
    return {"status": "moved", "swapped_with": occupant["id"] if occupant else None}


async def update_text(conn: asyncpg.Connection, user_id: str, item_id: UUID, text: str) -> dict:
    result = await conn.execute(
        """
        UPDATE day_plan_item SET freeform_text = $3, updated_at = now()
        WHERE id = $1 AND user_id = $2 AND entity_type = 'freeform'
        """,
        item_id, to_uuid(user_id), text,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Freeform block not found")
    return {"status": "updated"}


async def delete_item(conn: asyncpg.Connection, user_id: str, item_id: UUID) -> dict:
    await conn.execute(
        "DELETE FROM day_plan_item WHERE id = $1 AND user_id = $2", item_id, to_uuid(user_id)
    )
    return {"status": "deleted"}


async def remove_slot(conn: asyncpg.Connection, user_id: str, data: SlotRemove) -> dict:
    """Close up an empty slot: the section loses one, and everything below moves up."""
    uid = to_uuid(user_id)
    async with conn.transaction():
        occupied = await conn.fetchval(
            """
            SELECT 1 FROM day_plan_item
            WHERE user_id = $1 AND plan_date = $2 AND section = $3 AND slot_index = $4
            """,
            uid, data.plan_date, data.section, data.slot_index,
        )
        if occupied:
            raise HTTPException(409, "Only an empty slot can be removed")

        current = await conn.fetchval(_EFFECTIVE_COUNT_SQL, uid, data.plan_date, data.section)
        if data.slot_index >= current:
            raise HTTPException(404, "No such slot")

        # Each block steps into the slot above it, which its neighbour is still
        # leaving -- so the one-per-slot check waits for commit.
        await conn.execute("SET CONSTRAINTS day_plan_item_one_per_slot DEFERRED")
        await conn.execute(
            """
            UPDATE day_plan_item SET slot_index = slot_index - 1, updated_at = now()
            WHERE user_id = $1 AND plan_date = $2 AND section = $3 AND slot_index > $4
            """,
            uid, data.plan_date, data.section, data.slot_index,
        )
        await _set_slot_count(conn, uid, data.plan_date, data.section, current - 1)
    return {"status": "removed", "slot_count": current - 1}
