"""Verifies the db.py invariants: config resolves, reads work, writes are
rejected, and local-day bucketing actually shifts entries off UTC days.

Run: .venv/bin/python check_db.py
"""
import asyncio

import asyncpg

import db


async def main() -> None:
    print(f"timezone : {db.DEFAULT_TZ}")
    print(f"account  : {db.USER_EMAIL}")

    uid = await db.user_id()
    print(f"user_id  : {uid}\n")

    # 1. reads work
    async with db.read_only() as conn:
        n = await conn.fetchval(
            "SELECT count(*) FROM entry WHERE user_id = $1", uid
        )
    print(f"[ok] read: {n} entries")

    # 2. writes are rejected by Postgres, not by us
    try:
        async with db.read_only() as conn:
            await conn.execute(
                "UPDATE prioritry SET name = name WHERE user_id = $1", uid
            )
    except asyncpg.exceptions.ReadOnlySQLTransactionError as exc:
        print(f"[ok] write blocked: {type(exc).__name__}")
    else:
        raise SystemExit("[FAIL] a write succeeded inside read_only()")

    # 3. local-day bucketing differs from naive UTC bucketing
    tz = db.DEFAULT_TZ
    async with db.read_only() as conn:
        mismatched = await conn.fetchval(
            f"""
            SELECT count(*)
            FROM entry
            WHERE user_id = $1
              AND {db.local_day('created_at', 2)} <> (created_at)::date
            """,
            uid, tz,
        )
    print(f"[ok] {mismatched} entries land on a different day in {tz} "
          f"than in UTC")

    # 4. range helpers
    start, end = db.default_range(30, tz)
    lo, hi = db.day_bounds_utc(start, end, tz)
    print(f"[ok] last 30d = {start}..{end}  ->  {lo.isoformat()} .. {hi.isoformat()}")

    await db.close_pool()


if __name__ == "__main__":
    asyncio.run(main())
