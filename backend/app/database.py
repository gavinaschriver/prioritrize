import asyncpg
from app.config import settings

pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
            statement_cache_size=0,  # Required for Supabase Session Pooler (PgBouncer)
        )
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None


async def get_conn():
    p = await get_pool()
    async with p.acquire() as conn:
        yield conn
