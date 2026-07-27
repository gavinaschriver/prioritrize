"""One-off connectivity check: confirms DATABASE_URL works and reports which
user_ids actually have data, so we know what to scope the MCP server to.

Run: python probe.py
"""
import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / "backend" / ".env"


async def main() -> None:
    load_dotenv(ENV_PATH)
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit(f"DATABASE_URL not found in {ENV_PATH}")

    conn = await asyncpg.connect(url, statement_cache_size=0)
    try:
        rows = await conn.fetch(
            """
            SELECT u.id,
                   u.email,
                   (SELECT count(*) FROM prioritry p WHERE p.user_id = u.id) AS prioritries,
                   (SELECT count(*) FROM entry e WHERE e.user_id = u.id) AS entries,
                   (SELECT min(e.created_at) FROM entry e WHERE e.user_id = u.id) AS first_entry,
                   (SELECT max(e.created_at) FROM entry e WHERE e.user_id = u.id) AS last_entry
            FROM auth.users u
            ORDER BY entries DESC
            """
        )
        print(f"connected ok - {len(rows)} user(s)\n")
        for r in rows:
            print(f"  {r['id']}  {r['email']}")
            print(f"    prioritries={r['prioritries']}  entries={r['entries']}")
            print(f"    range: {r['first_entry']} -> {r['last_entry']}\n")

        tb = await conn.fetch(
            """
            SELECT count(*) FILTER (WHERE timeblock IS NOT NULL) AS with_timeblock,
                   count(*) AS total
            FROM prioritry WHERE is_active
            """
        )
        print(f"active prioritries with a timeblock: "
              f"{tb[0]['with_timeblock']}/{tb[0]['total']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
