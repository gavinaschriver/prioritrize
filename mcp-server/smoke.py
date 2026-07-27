"""Runs every curated query against the real DB and prints the output, so the
SQL is validated before it's wrapped in MCP plumbing.

Run: .venv/bin/python smoke.py
"""
import asyncio

import db
import queries


async def main() -> None:
    tz = db.DEFAULT_TZ
    start, end = db.default_range(30, tz)
    today = db.today(tz).isoformat()

    checks = [
        ("list_prioritries", queries.list_prioritries()),
        ("time_spent", queries.time_spent(start, end, tz, limit=10)),
        ("consistency", queries.consistency(start, end, tz)),
        ("tag_breakdown", queries.tag_breakdown(start, end, tz)),
        ("timeline (week)", queries.timeline(start, end, tz, "week")),
        ("day_detail", queries.day_detail(today, tz)),
        ("search_text", queries.search_text("work")),
        ("todo_and_project_status", queries.todo_and_project_status()),
    ]

    failures = 0
    for name, coro in checks:
        print("=" * 70)
        print(f"### {name}")
        print("=" * 70)
        try:
            print(await coro)
        except Exception as exc:  # noqa: BLE001 - smoke test wants everything
            failures += 1
            print(f"!!! FAILED: {type(exc).__name__}: {exc}")
        print()

    await db.close_pool()
    print("=" * 70)
    print(f"{len(checks) - failures}/{len(checks)} queries ok")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
