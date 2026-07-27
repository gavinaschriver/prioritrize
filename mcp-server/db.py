"""Connection, config, and timezone plumbing shared by every MCP tool.

Two invariants live here and nowhere else:

1. Every query runs inside a READ ONLY transaction. This server connects with
   the app's own DATABASE_URL, which bypasses RLS, so the read-only guard is
   what makes it safe to point an LLM at.
2. Days are bucketed in the user's local timezone, not UTC. Entries are stored
   as UTC timestamptz; a naive `created_at::date` would misfile every entry
   logged before ~7pm local as the wrong day.
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo, available_timezones

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
# backend/.env holds DATABASE_URL; mcp-server/.env (optional) overrides and
# holds this server's own settings.
load_dotenv(ROOT.parent / "backend" / ".env")
load_dotenv(ROOT / ".env", override=True)

DEFAULT_USER_EMAIL = "gavin.a.schriver@gmail.com"


def _system_timezone() -> str:
    """Best-effort IANA name for the host timezone, e.g. 'America/Chicago'."""
    try:
        link = Path("/etc/localtime").resolve()
        parts = link.parts
        if "zoneinfo" in parts:
            name = "/".join(parts[parts.index("zoneinfo") + 1:])
            if name in available_timezones():
                return name
    except OSError:
        pass
    return "UTC"


DEFAULT_TZ = os.environ.get("PRIORITRIZE_TZ") or _system_timezone()
USER_EMAIL = os.environ.get("PRIORITRIZE_USER_EMAIL") or DEFAULT_USER_EMAIL

_pool: asyncpg.Pool | None = None
_user_id: str | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError(
                "DATABASE_URL is not set. Expected it in backend/.env "
                "or mcp-server/.env"
            )
        _pool = await asyncpg.create_pool(
            url,
            min_size=1,
            max_size=4,
            statement_cache_size=0,  # required for Supabase's PgBouncer pooler
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def read_only():
    """Yield a connection pinned inside a READ ONLY transaction.

    Postgres itself rejects INSERT/UPDATE/DELETE/DDL in this state, so this is
    a real guard rather than string-matching on the SQL text.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction(readonly=True):
            yield conn


@asynccontextmanager
async def rls_scoped(timeout_ms: int = 15_000):
    """Read-only connection that additionally enforces the app's RLS policies.

    `read_only()` connects with the app's own credentials, which bypass RLS --
    fine for the curated tools, whose SQL is fixed and always filters by
    user_id, but not for arbitrary model-authored SQL, which could read other
    accounts' rows by simply omitting the filter.

    Here we drop to Supabase's `authenticated` role and set the JWT claims it
    derives auth.uid() from, so the policies written in the migrations apply
    exactly as they do for a logged-in browser session. Cross-account rows
    become invisible rather than merely discouraged.
    """
    uid = await user_id()  # resolved first: `authenticated` can't read auth.users
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction(readonly=True):
            await conn.execute(
                "SELECT set_config('statement_timeout', $1, true)", str(timeout_ms)
            )
            await conn.execute(
                "SELECT set_config('request.jwt.claims', $1, true)",
                json.dumps({"sub": uid, "role": "authenticated"}),
            )
            await conn.execute(
                "SELECT set_config('request.jwt.claim.sub', $1, true)", uid
            )
            await conn.execute("SELECT set_config('role', 'authenticated', true)")
            yield conn


async def user_id() -> str:
    """Resolve the configured account's UUID, cached for the process."""
    global _user_id
    if _user_id is None:
        async with read_only() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM auth.users WHERE email = $1", USER_EMAIL
            )
        if row is None:
            raise RuntimeError(
                f"No auth.users row for {USER_EMAIL!r}. "
                "Set PRIORITRIZE_USER_EMAIL in mcp-server/.env"
            )
        _user_id = str(row["id"])
    return _user_id


# --- timezone helpers -------------------------------------------------------
#
# SQL that buckets a UTC timestamptz into a local calendar day. Postgres
# handles DST transitions correctly here, which is why we push the conversion
# into SQL instead of bucketing in Python.
LOCAL_DAY = "(({col}) AT TIME ZONE ${param})::date"


def local_day(col: str, param: int) -> str:
    return LOCAL_DAY.format(col=col, param=param)


def resolve_tz(tz: str | None) -> str:
    name = tz or DEFAULT_TZ
    try:
        ZoneInfo(name)
    except Exception as exc:
        raise ValueError(f"Unknown timezone {name!r}") from exc
    return name


def day_bounds_utc(start: str, end: str, tz: str) -> tuple[datetime, datetime]:
    """Local inclusive date range -> half-open UTC instant range.

    `end` is inclusive of the whole day, matching the app's dashboard
    semantics, so the returned upper bound is midnight of the following day.
    """
    zone = ZoneInfo(tz)
    utc = ZoneInfo("UTC")
    start_local = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=zone)
    end_local = (
        datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=zone)
        + timedelta(days=1)
    )
    return start_local.astimezone(utc), end_local.astimezone(utc)


def today(tz: str) -> date:
    return datetime.now(ZoneInfo(tz)).date()


def default_range(days: int, tz: str) -> tuple[str, str]:
    """The last `days` calendar days ending today, inclusive of both ends."""
    end = today(tz)
    start = end - timedelta(days=days - 1)
    return start.isoformat(), end.isoformat()


def resolve_range(
    start: str | None, end: str | None, days: int, tz: str
) -> tuple[str, str]:
    """Fill in whichever half of the range the caller left out."""
    if start and end:
        return start, end
    if start and not end:
        return start, today(tz).isoformat()
    if end and not start:
        end_date = date.fromisoformat(end)
        return (end_date - timedelta(days=days - 1)).isoformat(), end
    return default_range(days, tz)
