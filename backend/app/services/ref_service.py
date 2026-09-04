import asyncpg
from uuid import UUID


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def next_ref_number(conn: asyncpg.Connection, user_id) -> int:
    """Claim the next reference number for this user.

    Todos and project tasks draw from one counter, so a bare "#1042" names
    exactly one thing without the reader having to know which kind it is. The
    UPDATE takes a row lock, so two creates in flight queue rather than collide.
    """
    uid = to_uuid(user_id)
    number = await conn.fetchval(
        """
        INSERT INTO ref_counter (user_id, last_number)
        VALUES ($1, 1000)
        ON CONFLICT (user_id) DO UPDATE SET last_number = ref_counter.last_number + 1
        RETURNING last_number
        """,
        uid,
    )
    return number


async def resolve(conn: asyncpg.Connection, user_id, number: int) -> dict | None:
    """Find whatever carries this number, or nothing.

    Checked against both tables because the number space is shared; at most one
    can match.
    """
    uid = to_uuid(user_id)
    row = await conn.fetchrow(
        """
        SELECT 'todo' AS entity_type, id AS entity_id, name,
               NULL::uuid AS project_id, completed_at
        FROM todo WHERE user_id = $1 AND ref_number = $2
        UNION ALL
        SELECT 'project_task', id, name, project_id, completed_at
        FROM project_task WHERE user_id = $1 AND ref_number = $2
        """,
        uid, number,
    )
    return dict(row) if row else None
