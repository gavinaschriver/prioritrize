"""Whole-user reconcile between dated items and a dedicated Google calendar.

The unit of sync is the user, not the item. One code path replaces twelve
(3 item types x 4 mutations), and it is the only shape that can handle
delete_project: that relies on ON DELETE CASCADE to remove project_task rows,
so the API never learns the deleted task ids and could never clean up their
events one at a time. It also copes with due_date being nulled, and self-heals
drift. At tens of rows the two SELECTs are milliseconds, and the content hash
makes the steady state zero Google API calls.

Roll-forward is the point of the whole feature. scoring_service._deadline_score
charges -point_value EVERY day an item is past due and unchecked, but a
calendar event fires its reminder once and then goes quiet. So an incomplete
overdue item's event is moved to the next upcoming slot on every pass, which
re-arms Google's reminder daily. Because the target moves, the content hash
changes, so this falls out of the ordinary diff with no special-case code.
"""

import asyncio
import hashlib
import json
import logging
from datetime import date as date_cls, datetime, time as time_cls, timedelta, timezone as dt_timezone
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import asyncpg

from app.config import settings
from app.database import get_pool
from app.services import google_oauth_service as oauth
from app.services.google_calendar_client import (
    GoogleCalendarClient,
    GoogleCalendarError,
    GoogleEventGoneError,
    GooglePermissionError,
)
from app.services.google_oauth_service import GoogleAuthError

logger = logging.getLogger(__name__)

CALENDAR_SUMMARY = "PRIORI-TRIZE"
CALENDAR_COLOR = "#1d4ed8"
COMPLETED_COLOR_ID = "8"  # graphite

ITEM_PATHS = {
    "todo": "/manage-todos",
    "project": "/manage-projects",
    "project_task": "/manage-projects",
}


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


def _tz(tz_str: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_str or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


# --- target time ------------------------------------------------------------

def target_start(item: dict, conn_settings: dict, stored_start, now: datetime) -> datetime:
    """Where this item's event belongs right now.

    Completed items freeze where they already are. Incomplete items roll to the
    next occurrence that is still in the future — not blindly to "today",
    because placing the reminder at 9am when it is already 10am fires nothing,
    a silent failure indistinguishable from a broken integration.
    """
    tz = _tz(conn_settings["timezone"])
    default_hour = time_cls(hour=conn_settings["default_hour"])

    if item["completed_at"] is not None:
        if stored_start is not None:
            return stored_start
        # Completed before it was ever synced: put it on the day it was done.
        d = item["completed_at"].astimezone(tz).date()
        return datetime.combine(d, default_hour, tzinfo=tz)

    hour = item.get("due_time") or default_hour
    d: date_cls = item["due_date"]

    if conn_settings["roll_forward"]:
        # Advance the DATE and rebuild the aware datetime each step, so the
        # target hour is re-resolved against the zone rather than carried
        # along. (zoneinfo's own timedelta arithmetic is wall-clock preserving
        # and would give the same answer here; this just keeps "which calendar
        # day" the explicit unit, which is what the scoring rule works in.)
        # The guard caps a decade of days so a bad clock cannot spin forever.
        guard = 0
        while datetime.combine(d, hour, tzinfo=tz) <= now and guard < 3660:
            d += timedelta(days=1)
            guard += 1

    return datetime.combine(d, hour, tzinfo=tz)


# --- event body -------------------------------------------------------------

def _summary(item: dict) -> str:
    name = item["name"]
    if item["item_type"] == "project":
        return f"[Project] {name}"
    if item["item_type"] == "project_task":
        return f"{item.get('project_name') or 'Project'}: {name}"
    return name


def _type_label(item_type: str) -> str:
    return {"todo": "Todo", "project": "Project", "project_task": "Task"}[item_type]


def build_event_body(item: dict, conn_settings: dict, start: datetime, now: datetime) -> dict:
    """The full event as it should look. Hashed wholesale, so any drift heals."""
    tz_name = conn_settings["timezone"]
    duration = timedelta(minutes=conn_settings["default_duration_minutes"])
    end = start + duration
    completed = item["completed_at"] is not None

    summary = _summary(item)
    days_overdue = 0
    if not completed:
        days_overdue = (start.date() - item["due_date"]).days

    if completed:
        summary = f"✓ {summary}"
    elif days_overdue > 0:
        summary = f"⚠️ {summary} ({days_overdue}d overdue)"

    pts = item.get("point_value")
    bits = [_type_label(item["item_type"])]
    if pts is not None:
        bits.append(f"{pts} pts")
    # The event moves; the record of what was committed to does not.
    bits.append(f"originally due {item['due_date'].strftime('%b %-d, %Y')}")
    description = " · ".join(bits)
    if completed:
        description += f"\nCompleted {item['completed_at'].astimezone(_tz(tz_name)).strftime('%b %-d, %Y')}"
    description += f"\n{settings.frontend_url}{ITEM_PATHS[item['item_type']]}"

    reminders = (
        # A done item must never ping again.
        {"useDefault": False, "overrides": []}
        if completed
        else {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": m} for m in conn_settings["reminder_minutes"]
            ],
        }
    )

    body = {
        "summary": summary,
        "description": description,
        # Naive local ISO plus a separate timeZone is the shape Google wants.
        "start": {"dateTime": start.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": tz_name},
        "end": {"dateTime": end.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": tz_name},
        "reminders": reminders,
        # Self-describing in Google's UI, and lets orphaned events be re-adopted
        # via events.list?privateExtendedProperty=app%3Dprioritrize if the link
        # table were ever lost.
        "extendedProperties": {
            "private": {
                "app": "prioritrize",
                "item_type": item["item_type"],
                "item_id": str(item["id"]),
                "completed": "true" if completed else "false",
            }
        },
    }
    if completed:
        body["colorId"] = COMPLETED_COLOR_ID
    return body


def content_hash(body: dict) -> str:
    return hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


# --- data loading -----------------------------------------------------------

async def load_dated_items(conn: asyncpg.Connection, user_id: str) -> list[dict]:
    uid = to_uuid(user_id)

    todos = await conn.fetch(
        """
        SELECT id, name, point_value, due_date, due_time, completed_at
        FROM todo WHERE user_id = $1 AND due_date IS NOT NULL
        """,
        uid,
    )
    projects = await conn.fetch(
        """
        SELECT id, name, point_value, due_date, completed_at
        FROM project WHERE user_id = $1 AND due_date IS NOT NULL
        """,
        uid,
    )
    tasks = await conn.fetch(
        """
        SELECT pt.id, pt.name, pt.point_value, pt.due_date, pt.due_time, pt.completed_at,
               p.name AS project_name
        FROM project_task pt
        JOIN project p ON p.id = pt.project_id
        WHERE pt.user_id = $1 AND pt.due_date IS NOT NULL
        """,
        uid,
    )

    items: list[dict] = []
    for row in todos:
        items.append({**dict(row), "item_type": "todo"})
    for row in projects:
        # Projects are milestone-grained and always use the default hour.
        items.append({**dict(row), "item_type": "project", "due_time": None})
    for row in tasks:
        items.append({**dict(row), "item_type": "project_task"})
    return items


# --- reconcile --------------------------------------------------------------

async def sync_user(conn: asyncpg.Connection, user_id: str) -> dict:
    """Reconcile one user's dated items with their calendar. Safe to call often."""
    result = {
        "synced": False, "created": 0, "updated": 0, "deleted": 0,
        "unchanged": 0, "api_calls": 0, "status": None, "error": None,
    }

    if not settings.google_configured:
        return result

    row = await oauth.get_connection(conn, user_id)
    # Cheap guard first, so the mutation triggers cost ~nothing for the
    # overwhelming majority of users who never connect Google.
    if row is None or row["status"] != "connected":
        result["status"] = row["status"] if row else None
        return result

    conn_settings = {
        "timezone": row["timezone"],
        "default_hour": row["default_hour"],
        "default_duration_minutes": row["default_duration_minutes"],
        "reminder_minutes": list(row["reminder_minutes"]),
        "roll_forward": row["roll_forward"],
    }
    client = GoogleCalendarClient(conn, row)

    try:
        calendar_id = row["calendar_id"]
        if not calendar_id:
            calendar_id = await client.create_calendar(CALENDAR_SUMMARY, conn_settings["timezone"])
            await client.show_in_calendar_list(calendar_id, CALENDAR_COLOR)
            await conn.execute(
                "UPDATE google_calendar_connection SET calendar_id = $2, updated_at = now() WHERE user_id = $1",
                to_uuid(user_id), calendar_id,
            )

        items = await load_dated_items(conn, user_id)
        link_rows = await conn.fetch(
            "SELECT item_type, item_id, google_event_id, event_start, content_hash, calendar_id"
            " FROM google_calendar_event WHERE user_id = $1",
            to_uuid(user_id),
        )
        links = {(r["item_type"], r["item_id"]): dict(r) for r in link_rows}
        now = datetime.now(_tz(conn_settings["timezone"]))

        seen: set[tuple[str, UUID]] = set()

        for item in items:
            key = (item["item_type"], item["id"])
            seen.add(key)
            link = links.get(key)

            start = target_start(item, conn_settings, link["event_start"] if link else None, now)
            body = build_event_body(item, conn_settings, start, now)
            digest = content_hash(body)

            if link is None:
                event_id = await client.insert_event(calendar_id, body)
                await _upsert_link(conn, user_id, item, calendar_id, event_id, start, digest)
                result["created"] += 1
                continue

            if link["content_hash"] == digest and link["calendar_id"] == calendar_id:
                result["unchanged"] += 1
                continue

            try:
                await client.patch_event(link["calendar_id"], link["google_event_id"], body)
                await _upsert_link(conn, user_id, item, calendar_id, link["google_event_id"], start, digest)
                result["updated"] += 1
            except GoogleEventGoneError:
                # Deleted in Google. Recreate rather than leaving a dead link.
                event_id = await client.insert_event(calendar_id, body)
                await _upsert_link(conn, user_id, item, calendar_id, event_id, start, digest)
                result["created"] += 1

        # Whatever is left has no source item: deleted, or due_date nulled.
        for key, link in links.items():
            if key in seen:
                continue
            try:
                await client.delete_event(link["calendar_id"], link["google_event_id"])
            except GoogleEventGoneError:
                pass  # already gone; dropping the row is still correct
            await conn.execute(
                "DELETE FROM google_calendar_event WHERE user_id = $1 AND item_type = $2 AND item_id = $3",
                to_uuid(user_id), key[0], key[1],
            )
            result["deleted"] += 1

        await conn.execute(
            """
            UPDATE google_calendar_connection
            SET last_synced_at = now(), last_error = NULL, status = 'connected', updated_at = now()
            WHERE user_id = $1
            """,
            to_uuid(user_id),
        )
        result["synced"] = True
        result["status"] = "connected"

    except GoogleAuthError as exc:
        # invalid_grant is terminal: revoked, expired, or the 7-day "Testing"
        # publishing-status trap. Stop retrying and surface it loudly.
        status = "needs_reauth" if exc.terminal else "error"
        await oauth.set_status(conn, user_id, status, str(exc))
        result["status"] = status
        result["error"] = str(exc)
        logger.warning("google calendar auth failed for %s: %s", user_id, exc)
    except GooglePermissionError as exc:
        await oauth.set_status(conn, user_id, "error", str(exc))
        result["status"] = "error"
        result["error"] = str(exc)
        logger.error("google calendar scope problem for %s: %s", user_id, exc)
    except GoogleCalendarError as exc:
        await oauth.set_status(conn, user_id, "error", str(exc))
        result["status"] = "error"
        result["error"] = str(exc)
        logger.warning("google calendar sync failed for %s: %s", user_id, exc)

    result["api_calls"] = client.api_calls
    logger.info(
        "calendar sync user=%s created=%d updated=%d deleted=%d unchanged=%d api_calls=%d",
        user_id, result["created"], result["updated"], result["deleted"],
        result["unchanged"], result["api_calls"],
    )
    return result


async def _upsert_link(
    conn: asyncpg.Connection, user_id: str, item: dict,
    calendar_id: str, event_id: str, start: datetime, digest: str,
) -> None:
    await conn.execute(
        """
        INSERT INTO google_calendar_event
            (user_id, item_type, item_id, calendar_id, google_event_id, event_start, content_hash, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (user_id, item_type, item_id) DO UPDATE SET
            calendar_id     = EXCLUDED.calendar_id,
            google_event_id = EXCLUDED.google_event_id,
            event_start     = EXCLUDED.event_start,
            content_hash    = EXCLUDED.content_hash,
            synced_at       = now()
        """,
        to_uuid(user_id), item["item_type"], item["id"],
        calendar_id, event_id, start.astimezone(dt_timezone.utc), digest,
    )


# --- background triggering --------------------------------------------------

_locks: dict[str, asyncio.Lock] = {}
_dirty: set[str] = set()


async def sync_user_bg(user_id: str) -> None:
    """Entry point for BackgroundTasks.

    Acquires its OWN pool connection. get_conn is a yield dependency, and in
    FastAPI >= 0.106 its teardown runs BEFORE background tasks, so the
    request's connection is already back in the pool by the time this runs.
    Reusing it works locally and fails intermittently in production.

    Debounced: a sync already in flight for this user just marks the work
    dirty, and one more pass runs when it finishes.
    """
    if not settings.google_configured:
        return

    lock = _locks.setdefault(user_id, asyncio.Lock())
    if lock.locked():
        _dirty.add(user_id)
        return

    async with lock:
        while True:
            _dirty.discard(user_id)
            try:
                pool = await get_pool()
                async with pool.acquire() as conn:
                    await sync_user(conn, user_id)
            except Exception:
                logger.exception("background calendar sync failed for %s", user_id)
            if user_id not in _dirty:
                break


async def sync_all_users(conn: asyncpg.Connection) -> dict:
    """Nightly reconcile. This is what rolls events forward on the days you
    never open the app — the case the whole feature exists for."""
    rows = await conn.fetch(
        "SELECT user_id FROM google_calendar_connection WHERE status = 'connected'"
    )
    totals = {"users": 0, "created": 0, "updated": 0, "deleted": 0, "unchanged": 0, "api_calls": 0}
    for row in rows:
        result = await sync_user(conn, str(row["user_id"]))
        totals["users"] += 1
        for key in ("created", "updated", "deleted", "unchanged", "api_calls"):
            totals[key] += result[key]
    return totals


async def refresh_timezone(conn: asyncpg.Connection, user_id: str, tz_str: str) -> None:
    """Keep the stored timezone current as the user travels. Only writes when
    it actually differs, so this stays free on the day-summary hot path."""
    if not tz_str:
        return
    await conn.execute(
        """
        UPDATE google_calendar_connection
        SET timezone = $2, updated_at = now()
        WHERE user_id = $1 AND timezone IS DISTINCT FROM $2
        """,
        to_uuid(user_id), tz_str,
    )
