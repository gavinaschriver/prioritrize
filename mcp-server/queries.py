"""The analytics behind each curated MCP tool.

Every function returns a formatted string, because the consumer is a language
model rather than a UI. Two conventions are worth knowing:

* Ranges are inclusive on both ends and expressed as local calendar dates.
* Anything that could silently undercount says so in the output. Only some
  prioritries carry a `timeblock`, so any minutes figure is a floor, not a
  total, and the tools name the prioritries they had to leave out.
"""
from __future__ import annotations

from datetime import date, timedelta

import db


# --- formatting helpers -----------------------------------------------------

def fmt_minutes(minutes: int | None) -> str:
    if not minutes:
        return "-"
    hours, mins = divmod(int(minutes), 60)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins}m"


def table(headers: list[str], rows: list[list[str]]) -> str:
    """Fixed-width text table. Cheaper in tokens than markdown pipes."""
    if not rows:
        return "  (none)"
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))
    out = ["  ".join(h.ljust(widths[i]) for i, h in enumerate(headers)).rstrip()]
    out.append("  ".join("-" * widths[i] for i in range(len(headers))))
    for row in rows:
        out.append("  ".join(c.ljust(widths[i]) for i, c in enumerate(row)).rstrip())
    return "\n".join(out)


def header(title: str, start: str, end: str, tz: str) -> str:
    span = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    return f"{title}\n{start} to {end} ({span} days, {tz})\n"


# --- tools ------------------------------------------------------------------

async def list_prioritries(include_inactive: bool = False) -> str:
    """The catalog of tracked items, with the metadata other tools depend on."""
    uid = await db.user_id()
    async with db.read_only() as conn:
        rows = await conn.fetch(
            """
            SELECT p.name, t.name AS type_name, p.point_value, p.timeblock,
                   p.can_repeat, p.is_active,
                   (SELECT count(*) FROM entry e WHERE e.prioritry_id = p.id)
                       AS lifetime_entries
            FROM prioritry p
            JOIN type t ON t.id = p.type_id
            WHERE p.user_id = $1
              AND ($2 OR p.is_active)
            ORDER BY p.is_active DESC, t.name, p.point_value DESC, p.name
            """,
            uid, include_inactive,
        )

    body = table(
        ["name", "type", "pts", "timeblock", "repeats", "active", "entries"],
        [
            [
                r["name"],
                r["type_name"],
                str(r["point_value"]),
                fmt_minutes(r["timeblock"]),
                "yes" if r["can_repeat"] else "no",
                "yes" if r["is_active"] else "no",
                str(r["lifetime_entries"]),
            ]
            for r in rows
        ],
    )
    n_tb = sum(1 for r in rows if r["timeblock"] is not None)
    return (
        f"Prioritries ({len(rows)} shown, {n_tb} with a timeblock)\n\n"
        f"{body}\n\n"
        "'timeblock' is the minutes one entry represents. Prioritries without "
        "one can only be counted by entry, never by time."
    )


async def time_spent(start: str, end: str, tz: str, limit: int = 30) -> str:
    """Rank prioritries by minutes logged; entry counts where time is unknown."""
    uid = await db.user_id()
    lo, hi = db.day_bounds_utc(start, end, tz)
    async with db.read_only() as conn:
        rows = await conn.fetch(
            f"""
            SELECT p.name, t.name AS type_name, p.timeblock,
                   count(e.id) AS entries,
                   count(DISTINCT {db.local_day('e.created_at', 4)}) AS days
            FROM prioritry p
            JOIN type t ON t.id = p.type_id
            JOIN entry e
              ON e.prioritry_id = p.id
             AND e.user_id = p.user_id
             AND e.created_at >= $2
             AND e.created_at < $3
            WHERE p.user_id = $1
            GROUP BY p.name, t.name, p.timeblock
            ORDER BY count(e.id) DESC
            """,
            uid, lo, hi, tz,
        )

    timed = [r for r in rows if r["timeblock"] is not None]
    untimed = [r for r in rows if r["timeblock"] is None]
    timed.sort(key=lambda r: r["entries"] * r["timeblock"], reverse=True)

    total = sum(r["entries"] * r["timeblock"] for r in timed)
    timed_tbl = table(
        ["prioritry", "type", "time", "entries", "days", "per entry"],
        [
            [
                r["name"],
                r["type_name"],
                fmt_minutes(r["entries"] * r["timeblock"]),
                str(r["entries"]),
                str(r["days"]),
                fmt_minutes(r["timeblock"]),
            ]
            for r in timed[:limit]
        ],
    )
    untimed_tbl = table(
        ["prioritry", "type", "entries", "days"],
        [
            [r["name"], r["type_name"], str(r["entries"]), str(r["days"])]
            for r in untimed[:limit]
        ],
    )

    return (
        header("Time spent by prioritry", start, end, tz)
        + f"\nTracked time: {fmt_minutes(total)} across {len(timed)} prioritries\n\n"
        + timed_tbl
        + "\n\nLogged but not time-tracked (no timeblock set, so these are "
        "absent from the total above):\n\n"
        + untimed_tbl
    )


async def consistency(start: str, end: str, tz: str, type_name: str = "Goal") -> str:
    """Completion rate and streaks per prioritry — the 'what to improve' view."""
    uid = await db.user_id()
    lo, hi = db.day_bounds_utc(start, end, tz)
    start_d, end_d = date.fromisoformat(start), date.fromisoformat(end)

    async with db.read_only() as conn:
        items = await conn.fetch(
            f"""
            SELECT p.id, p.name, p.point_value,
                   {db.local_day('p.created_at', 2)} AS created_day
            FROM prioritry p
            JOIN type t ON t.id = p.type_id
            WHERE p.user_id = $1
              AND p.is_active
              AND ($3 = 'all' OR t.name = $3)
            ORDER BY p.name
            """,
            uid, tz, type_name,
        )
        hits = await conn.fetch(
            f"""
            SELECT e.prioritry_id AS pid,
                   {db.local_day('e.created_at', 4)} AS day
            FROM entry e
            WHERE e.user_id = $1
              AND e.created_at >= $2
              AND e.created_at < $3
            GROUP BY 1, 2
            """,
            uid, lo, hi, tz,
        )

    by_item: dict[str, set[date]] = {}
    for h in hits:
        by_item.setdefault(str(h["pid"]), set()).add(h["day"])

    today_d = db.today(tz)
    rows = []
    for item in items:
        days_hit = by_item.get(str(item["id"]), set())
        # Don't penalise a prioritry for days before it existed.
        first = max(start_d, item["created_day"])
        if first > end_d:
            continue
        possible = (end_d - first).days + 1
        hit_count = sum(1 for d in days_hit if d >= first)
        rate = hit_count / possible if possible else 0.0

        longest = run = 0
        cursor = first
        while cursor <= end_d:
            run = run + 1 if cursor in days_hit else 0
            longest = max(longest, run)
            cursor += timedelta(days=1)

        # A range ending today shouldn't report a broken streak just because
        # the day is still in progress.
        tail = end_d
        note = ""
        if end_d == today_d and today_d not in days_hit:
            tail = end_d - timedelta(days=1)
            note = "*"
        current = 0
        cursor = tail
        while cursor >= first and cursor in days_hit:
            current += 1
            cursor -= timedelta(days=1)

        rows.append({
            "name": item["name"],
            "pts": item["point_value"],
            "hit": hit_count,
            "possible": possible,
            "rate": rate,
            "current": f"{current}{note}",
            "longest": longest,
        })

    rows.sort(key=lambda r: r["rate"])
    body = table(
        ["prioritry", "pts", "days hit", "of", "rate", "streak", "best"],
        [
            [
                r["name"], str(r["pts"]), str(r["hit"]), str(r["possible"]),
                f"{r['rate']:.0%}", r["current"], str(r["longest"]),
            ]
            for r in rows
        ],
    )
    return (
        header(f"Consistency ({type_name})", start, end, tz)
        + "\nSorted worst-first. 'of' counts only days since the prioritry was "
        "created, so newer items aren't penalised for days they didn't exist.\n"
        "A * on the streak means today isn't logged yet and the streak is "
        "measured through yesterday.\n\n"
        + body
    )


async def tag_breakdown(start: str, end: str, tz: str) -> str:
    """What the #tags in entry comments add up to."""
    uid = await db.user_id()
    lo, hi = db.day_bounds_utc(start, end, tz)
    async with db.read_only() as conn:
        rows = await conn.fetch(
            f"""
            SELECT et.tag,
                   count(*) AS uses,
                   count(DISTINCT {db.local_day('e.created_at', 4)}) AS days,
                   sum(p.timeblock) AS minutes,
                   count(DISTINCT p.id) AS prioritries
            FROM entry_tag et
            JOIN entry e ON e.id = et.entry_id
            JOIN prioritry p ON p.id = e.prioritry_id
            WHERE et.user_id = $1
              AND e.created_at >= $2
              AND e.created_at < $3
            GROUP BY et.tag
            ORDER BY count(*) DESC, et.tag
            """,
            uid, lo, hi, tz,
        )

    body = table(
        ["tag", "uses", "days", "time", "prioritries"],
        [
            [
                r["tag"], str(r["uses"]), str(r["days"]),
                fmt_minutes(r["minutes"]), str(r["prioritries"]),
            ]
            for r in rows
        ],
    )
    return (
        header("Tag breakdown", start, end, tz)
        + "\nTime counts only entries whose prioritry has a timeblock.\n\n"
        + body
    )


async def timeline(start: str, end: str, tz: str, bucket: str = "day") -> str:
    """Entries, tracked time, and daily score over time."""
    if bucket not in ("day", "week", "month"):
        raise ValueError("bucket must be one of: day, week, month")
    uid = await db.user_id()
    lo, hi = db.day_bounds_utc(start, end, tz)

    async with db.read_only() as conn:
        rows = await conn.fetch(
            f"""
            WITH e AS (
                SELECT {db.local_day('entry.created_at', 4)} AS day,
                       prioritry_id
                FROM entry
                WHERE user_id = $1
                  AND created_at >= $2
                  AND created_at < $3
            )
            SELECT date_trunc($5, e.day::timestamp)::date AS bucket,
                   count(*) AS entries,
                   count(DISTINCT e.day) AS active_days,
                   count(DISTINCT e.prioritry_id) AS prioritries,
                   sum(p.timeblock) AS minutes
            FROM e
            JOIN prioritry p ON p.id = e.prioritry_id
            GROUP BY 1
            ORDER BY 1
            """,
            uid, lo, hi, tz, bucket,
        )
        scores = await conn.fetch(
            """
            SELECT date_trunc($4, date::timestamp)::date AS bucket,
                   round(sum(score), 1) AS score
            FROM daily_snapshot
            WHERE user_id = $1 AND date >= $2 AND date <= $3
            GROUP BY 1
            """,
            uid, date.fromisoformat(start), date.fromisoformat(end), bucket,
        )
    score_by_bucket = {r["bucket"]: r["score"] for r in scores}

    body = table(
        ["bucket", "entries", "active days", "prioritries", "time", "score"],
        [
            [
                r["bucket"].isoformat(), str(r["entries"]), str(r["active_days"]),
                str(r["prioritries"]), fmt_minutes(r["minutes"]),
                str(score_by_bucket.get(r["bucket"], "-")),
            ]
            for r in rows
        ],
    )
    return (
        header(f"Activity timeline by {bucket}", start, end, tz)
        + "\n'score' comes from daily_snapshot and is only present for days the "
        "app has finalised.\n\n"
        + body
    )


async def day_detail(day: str, tz: str) -> str:
    """Everything logged on one day: entries, todos, note, score."""
    uid = await db.user_id()
    lo, hi = db.day_bounds_utc(day, day, tz)
    async with db.read_only() as conn:
        entries = await conn.fetch(
            """
            SELECT p.name, t.name AS type_name, p.timeblock, p.point_value,
                   e.comment, e.created_at
            FROM entry e
            JOIN prioritry p ON p.id = e.prioritry_id
            JOIN type t ON t.id = p.type_id
            WHERE e.user_id = $1 AND e.created_at >= $2 AND e.created_at < $3
            ORDER BY e.created_at
            """,
            uid, lo, hi,
        )
        todos = await conn.fetch(
            """
            SELECT name, point_value, completed_at
            FROM todo
            WHERE user_id = $1 AND completed_at >= $2 AND completed_at < $3
            ORDER BY completed_at
            """,
            uid, lo, hi,
        )
        note = await conn.fetchval(
            "SELECT content FROM daily_notes WHERE user_id = $1 AND date = $2",
            uid, date.fromisoformat(day),
        )
        score = await conn.fetchval(
            "SELECT score FROM daily_snapshot WHERE user_id = $1 AND date = $2",
            uid, date.fromisoformat(day),
        )

    from zoneinfo import ZoneInfo
    zone = ZoneInfo(tz)
    entry_tbl = table(
        ["time", "prioritry", "type", "block", "comment"],
        [
            [
                e["created_at"].astimezone(zone).strftime("%H:%M"),
                e["name"], e["type_name"], fmt_minutes(e["timeblock"]),
                (e["comment"] or "")[:80],
            ]
            for e in entries
        ],
    )
    todo_tbl = table(
        ["todo", "pts", "completed"],
        [
            [t["name"], str(t["point_value"]),
             t["completed_at"].astimezone(zone).strftime("%H:%M")]
            for t in todos
        ],
    )
    minutes = sum(e["timeblock"] or 0 for e in entries)
    parts = [
        f"{day} ({tz})",
        f"score: {score if score is not None else 'not finalised'}   "
        f"entries: {len(entries)}   tracked time: {fmt_minutes(minutes)}",
        "\nEntries:\n" + entry_tbl,
        "\nTodos completed:\n" + todo_tbl,
    ]
    if note:
        parts.append("\nDaily note:\n" + note.strip())
    return "\n".join(parts)


async def search_text(term: str, limit: int = 40) -> str:
    """Full-text-ish search across every free-text surface in the app."""
    uid = await db.user_id()
    pattern = f"%{term}%"
    async with db.read_only() as conn:
        rows = await conn.fetch(
            """
            SELECT 'daily note' AS source, dn.date::text AS when_, dn.content AS body
            FROM daily_notes dn
            WHERE dn.user_id = $1 AND dn.content ILIKE $2
            UNION ALL
            SELECT 'entry: ' || p.name, e.created_at::date::text, e.comment
            FROM entry e
            JOIN prioritry p ON p.id = e.prioritry_id
            WHERE e.user_id = $1 AND e.comment ILIKE $2
            UNION ALL
            SELECT 'project update: ' || pr.name, pu.created_at::date::text, pu.body
            FROM project_update pu
            JOIN project pr ON pr.id = pu.project_id
            WHERE pu.user_id = $1 AND pu.body ILIKE $2
            UNION ALL
            SELECT 'project overview: ' || pr.name, pr.created_at::date::text,
                   pr.overview
            FROM project pr
            WHERE pr.user_id = $1 AND pr.overview ILIKE $2
            UNION ALL
            SELECT 'todo', td.created_at::date::text, td.name
            FROM todo td
            WHERE td.user_id = $1 AND td.name ILIKE $2
            ORDER BY 2 DESC
            LIMIT $3
            """,
            uid, pattern, limit,
        )

    if not rows:
        return f"No matches for {term!r}."
    out = [f"{len(rows)} match(es) for {term!r} (newest first):\n"]
    for r in rows:
        body = " ".join((r["body"] or "").split())
        if len(body) > 300:
            body = body[:300] + "..."
        out.append(f"{r['when_']}  [{r['source']}]\n  {body}\n")
    return "\n".join(out)


async def describe_schema() -> str:
    """Column listing for the app's tables, so run_sql doesn't have to guess."""
    async with db.read_only() as conn:
        rows = await conn.fetch(
            """
            SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_name = c.table_name AND t.table_schema = c.table_schema
            WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
            ORDER BY c.table_name, c.ordinal_position
            """
        )

    by_table: dict[str, list[str]] = {}
    for r in rows:
        null = "" if r["is_nullable"] == "NO" else " null"
        by_table.setdefault(r["table_name"], []).append(
            f"{r['column_name']} {r['data_type']}{null}"
        )
    out = ["Tables in schema `public`:\n"]
    for name, cols in by_table.items():
        out.append(f"{name}")
        for col in cols:
            out.append(f"    {col}")
        out.append("")
    out.append(
        "Notes:\n"
        "  entry.created_at is timestamptz in UTC. Bucket by local day with\n"
        "    (created_at AT TIME ZONE 'America/Chicago')::date\n"
        "  prioritry.timeblock is minutes per entry, and is NULL for most rows.\n"
        "  type.name is 'Goal' or 'Bonus'.\n"
        "  Every user-owned table has a user_id column."
    )
    return "\n".join(out)


async def run_sql(sql: str, limit: int = 200) -> str:
    """Execute a caller-supplied SELECT under RLS, read-only, with a timeout."""
    params = []
    if "$1" in sql:
        params.append(await db.user_id())

    async with db.rls_scoped() as conn:
        rows = await conn.fetch(sql, *params)

    if not rows:
        return "0 rows."
    truncated = len(rows) > limit
    shown = rows[:limit]
    headers = list(shown[0].keys())

    def cell(v) -> str:
        if v is None:
            return "-"
        text = " ".join(str(v).split())
        return text[:120] + "..." if len(text) > 120 else text

    body = table(headers, [[cell(r[h]) for h in headers] for r in shown])
    note = (
        f"\n\n({len(rows)} rows, showing first {limit}.)" if truncated
        else f"\n\n({len(rows)} row(s).)"
    )
    return body + note


async def todo_and_project_status() -> str:
    """Open and recently finished todos, projects, and project tasks."""
    uid = await db.user_id()
    async with db.read_only() as conn:
        todos = await conn.fetch(
            """
            SELECT name, point_value, due_date, completed_at, created_at
            FROM todo
            WHERE user_id = $1 AND completed_at IS NULL
            ORDER BY due_date NULLS LAST, created_at
            """,
            uid,
        )
        projects = await conn.fetch(
            """
            SELECT pr.name, pr.point_value, pr.due_date, pr.completed_at,
                   count(pt.id) AS tasks,
                   count(pt.id) FILTER (WHERE pt.completed_at IS NOT NULL)
                       AS done_tasks
            FROM project pr
            LEFT JOIN project_task pt ON pt.project_id = pr.id
            WHERE pr.user_id = $1 AND pr.completed_at IS NULL
            GROUP BY pr.id, pr.name, pr.point_value, pr.due_date, pr.completed_at
            ORDER BY pr.due_date NULLS LAST, pr.created_at
            """,
            uid,
        )

    todo_tbl = table(
        ["todo", "pts", "due", "age (days)"],
        [
            [
                t["name"], str(t["point_value"]),
                t["due_date"].isoformat() if t["due_date"] else "-",
                str((date.today() - t["created_at"].date()).days),
            ]
            for t in todos
        ],
    )
    proj_tbl = table(
        ["project", "pts", "due", "tasks done"],
        [
            [
                p["name"],
                str(p["point_value"]) if p["point_value"] is not None else "-",
                p["due_date"].isoformat() if p["due_date"] else "-",
                f"{p['done_tasks']}/{p['tasks']}",
            ]
            for p in projects
        ],
    )
    return (
        f"Open todos ({len(todos)}):\n{todo_tbl}\n\n"
        f"Open projects ({len(projects)}):\n{proj_tbl}"
    )
