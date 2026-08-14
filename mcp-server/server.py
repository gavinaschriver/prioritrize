"""MCP server exposing the PRIORI-TRIZE database for analysis.

Runs over stdio. Every tool reads through a READ ONLY transaction (see db.py);
nothing here can modify the database.

Tool docstrings are the model's only documentation, so they state the units and
the caveats rather than restating the signature.
"""
from __future__ import annotations

from mcp.server.fastmcp import FastMCP

import db
import queries

mcp = FastMCP("prioritrize")

RANGE_DOC = """
    Args:
        start: First day, YYYY-MM-DD (local). Defaults to `days` before end.
        end: Last day, YYYY-MM-DD (local), inclusive. Defaults to today.
        days: Window size when start/end are omitted. Default 30.
        tz: IANA timezone. Defaults to the host's ({tz}).
"""


def _range(start: str | None, end: str | None, days: int, tz: str | None):
    zone = db.resolve_tz(tz)
    lo, hi = db.resolve_range(start, end, days, zone)
    return lo, hi, zone


@mcp.tool()
async def list_prioritries(include_inactive: bool = False) -> str:
    """List every tracked habit/goal ("prioritry") with its configuration.

    Start here when you don't know what the user tracks. Shows type (Goal vs
    Bonus), point value, whether it repeats, and its timeblock -- the minutes one
    block represents. An entry can log several blocks at once, so lifetime_entries
    counts blocks, not rows. Prioritries with no timeblock cannot be measured in
    time, only in entry counts.
    """
    return await queries.list_prioritries(include_inactive)


@mcp.tool()
async def time_spent(
    start: str | None = None,
    end: str | None = None,
    days: int = 30,
    tz: str | None = None,
    limit: int = 30,
) -> str:
    """Rank prioritries by time spent over a date range.

    Answers "what did I spend the most time on?". Time is block count (summed
    entry.quantity) times the prioritry's timeblock. Only some prioritries have
    a timeblock, so the
    total is a floor, not a complete accounting -- the ones without are listed
    separately with their entry counts so nothing is silently dropped.
    """
    s, e, zone = _range(start, end, days, tz)
    return await queries.time_spent(s, e, zone, limit)


@mcp.tool()
async def consistency(
    start: str | None = None,
    end: str | None = None,
    days: int = 30,
    tz: str | None = None,
    type_name: str = "Goal",
) -> str:
    """Per-prioritry completion rate and streaks, worst performers first.

    Answers "what could I improve on?". For each active prioritry: days it was
    logged, days it could have been logged, completion rate, current streak and
    best streak. The denominator starts at the prioritry's creation date, so
    recently added items aren't penalised for days before they existed.

    type_name: "Goal", "Bonus", or "all". Goals are the daily commitments and
    are usually what matters for consistency; Bonuses are opportunistic.
    """
    s, e, zone = _range(start, end, days, tz)
    return await queries.consistency(s, e, zone, type_name)


@mcp.tool()
async def tag_breakdown(
    start: str | None = None,
    end: str | None = None,
    days: int = 30,
    tz: str | None = None,
) -> str:
    """Aggregate the #tags the user writes in entry comments.

    Tags are free-form labels inside entry comments (e.g. "#hot yoga"), giving
    a finer-grained view than the prioritry itself -- for instance which kind
    of exercise, not just that exercise happened.
    """
    s, e, zone = _range(start, end, days, tz)
    return await queries.tag_breakdown(s, e, zone)


@mcp.tool()
async def timeline(
    start: str | None = None,
    end: str | None = None,
    days: int = 30,
    tz: str | None = None,
    bucket: str = "day",
) -> str:
    """Activity over time: entries, tracked minutes, and daily score per bucket.

    Use for trend questions ("am I doing more or less than last month?").
    bucket is "day", "week", or "month". The score column comes from the app's
    finalised daily snapshots and is blank for days it hasn't computed.
    """
    s, e, zone = _range(start, end, days, tz)
    return await queries.timeline(s, e, zone, bucket)


@mcp.tool()
async def day_detail(day: str, tz: str | None = None) -> str:
    """Everything logged on a single day: entries with timestamps and comments,
    todos completed, the daily note, and the finalised score.

    Use to investigate a specific day surfaced by another tool -- e.g. the day
    a streak broke, or an unusually high or low scoring day.

    day: YYYY-MM-DD, local.
    """
    return await queries.day_detail(day, db.resolve_tz(tz))


@mcp.tool()
async def search_text(term: str, limit: int = 40) -> str:
    """Case-insensitive substring search across all free text in the app:
    daily notes, entry comments, project updates and overviews, and todo names.

    Use to find context the structured tables don't capture -- why a week went
    badly, when something was first mentioned, what a project involved.
    """
    return await queries.search_text(term, limit)


@mcp.tool()
async def open_work() -> str:
    """Current open todos and in-progress projects, with due dates, ages, and
    per-project task completion. Use for "what's outstanding?" questions.
    """
    return await queries.todo_and_project_status()


@mcp.tool()
async def describe_schema() -> str:
    """Column listing for every table, plus the conventions run_sql needs
    (UTC timestamps, the timeblock unit, the Goal/Bonus split).

    Call this before writing SQL with run_sql.
    """
    return await queries.describe_schema()


@mcp.tool()
async def run_sql(sql: str, limit: int = 200) -> str:
    """Run a read-only SQL query for questions the other tools don't cover.

    The connection is read-only and row-level security is enforced, so only the
    configured user's rows are visible and writes are rejected by the database.
    One statement per call; queries time out after 15 seconds.

    If the SQL references $1 it is bound to the user's UUID, so the idiomatic
    form is `... WHERE user_id = $1`. RLS already restricts rows, so the filter
    is for clarity and index use rather than safety.

    Timestamps are UTC. Bucket by local day with
    (created_at AT TIME ZONE 'America/Chicago')::date -- a bare ::date will
    misfile roughly a third of entries.
    """
    return await queries.run_sql(sql, limit)


if __name__ == "__main__":
    mcp.run()
