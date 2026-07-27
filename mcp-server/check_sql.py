"""Verifies the run_sql guards: RLS hides other accounts, writes are rejected,
multi-statement is rejected, and timeouts fire.

Run: .venv/bin/python check_sql.py
"""
import asyncio

import asyncpg

import db
import queries


async def main() -> None:
    uid = await db.user_id()

    # Baseline: the privileged connection sees every account's rows.
    async with db.read_only() as conn:
        all_entries = await conn.fetchval("SELECT count(*) FROM entry")
        mine = await conn.fetchval(
            "SELECT count(*) FROM entry WHERE user_id = $1", uid
        )
    print(f"privileged connection sees {all_entries} entries ({mine} mine)")

    # 1. RLS: an unfiltered query must return only this user's rows.
    async with db.rls_scoped() as conn:
        scoped = await conn.fetchval("SELECT count(*) FROM entry")
        role = await conn.fetchval("SELECT current_user")
        uid_fn = await conn.fetchval("SELECT auth.uid()")
    ok = scoped == mine
    print(f"[{'ok' if ok else 'FAIL'}] rls: unfiltered count = {scoped} "
          f"(expected {mine}), role={role}, auth.uid()={uid_fn}")
    if not ok:
        raise SystemExit("[FAIL] RLS did not scope the query")

    # 2. other users' rows are invisible, not merely unselected
    async with db.rls_scoped() as conn:
        others = await conn.fetchval(
            "SELECT count(*) FROM entry WHERE user_id <> $1", uid
        )
    print(f"[{'ok' if others == 0 else 'FAIL'}] cross-account rows visible: {others}")
    if others != 0:
        raise SystemExit("[FAIL] cross-account rows leaked")

    # 3. writes rejected
    try:
        await queries.run_sql("UPDATE todo SET name = name RETURNING id")
    except asyncpg.exceptions.PostgresError as exc:
        print(f"[ok] write rejected: {type(exc).__name__}")
    else:
        raise SystemExit("[FAIL] a write succeeded via run_sql")

    # 4. multiple statements rejected
    try:
        await queries.run_sql("SELECT 1; SELECT 2")
    except asyncpg.exceptions.PostgresError as exc:
        print(f"[ok] multi-statement rejected: {type(exc).__name__}")
    else:
        raise SystemExit("[FAIL] multi-statement query succeeded")

    # 5. statement timeout is armed
    try:
        await queries.run_sql("SELECT pg_sleep(20)")
    except asyncpg.exceptions.QueryCanceledError:
        print("[ok] statement_timeout fired")
    else:
        raise SystemExit("[FAIL] long query was not cancelled")

    # 6. a real analytical query still works end to end
    out = await queries.run_sql(
        """
        SELECT p.name,
               count(*) AS entries,
               count(DISTINCT (e.created_at AT TIME ZONE 'America/Chicago')::date)
                   AS days
        FROM entry e
        JOIN prioritry p ON p.id = e.prioritry_id
        WHERE e.user_id = $1
          AND e.created_at >= now() - interval '14 days'
        GROUP BY p.name
        ORDER BY entries DESC
        LIMIT 5
        """
    )
    print("\n[ok] sample query:\n" + out)

    await db.close_pool()
    print("\nall run_sql guards verified")


if __name__ == "__main__":
    asyncio.run(main())
