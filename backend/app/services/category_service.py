import asyncpg
from uuid import UUID
from fastapi import HTTPException
from app.models.category import CategoryCreate, CategoryUpdate, CategoryOut


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


_COLS = "id, user_id, name, created_at, updated_at"


async def assert_owned(conn: asyncpg.Connection, category_id, uid: UUID) -> None:
    """The FK only proves the category exists, not that it's this user's.

    The API connects as the table owner, so row-level security isn't doing this
    check for us -- every assignment has to prove ownership itself.
    """
    if category_id is None:
        return
    owned = await conn.fetchval(
        "SELECT 1 FROM category WHERE id = $1 AND user_id = $2",
        to_uuid(category_id), uid,
    )
    if not owned:
        raise HTTPException(status_code=404, detail="Category not found")


async def list_categories(conn: asyncpg.Connection, user_id: str) -> list[CategoryOut]:
    uid = to_uuid(user_id)
    # Counted as scalar subqueries rather than two LEFT JOINs, which would
    # multiply out and need DISTINCT to count either side correctly.
    rows = await conn.fetch(
        f"""
        SELECT {_COLS},
               (SELECT COUNT(*)::int FROM project p
                 WHERE p.category_id = c.id AND p.user_id = c.user_id) AS project_count,
               (SELECT COUNT(*)::int FROM todo t
                 WHERE t.category_id = c.id AND t.user_id = c.user_id) AS todo_count
        FROM category c
        WHERE c.user_id = $1
        ORDER BY lower(c.name) ASC
        """,
        uid,
    )
    return [CategoryOut(**dict(r)) for r in rows]


async def create_category(conn: asyncpg.Connection, user_id: str, data: CategoryCreate) -> CategoryOut:
    uid = to_uuid(user_id)
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required")
    try:
        row = await conn.fetchrow(
            f"INSERT INTO category (user_id, name) VALUES ($1, $2) RETURNING {_COLS}",
            uid, name,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=f'Category "{name}" already exists')
    return CategoryOut(**dict(row))


async def update_category(
    conn: asyncpg.Connection, category_id: UUID, user_id: str, data: CategoryUpdate
) -> CategoryOut:
    uid = to_uuid(user_id)
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required")
    try:
        row = await conn.fetchrow(
            f"""
            UPDATE category SET name = $3, updated_at = now()
            WHERE id = $1 AND user_id = $2
            RETURNING {_COLS}
            """,
            category_id, uid, name,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=f'Category "{name}" already exists')
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    counts = await conn.fetchrow(
        """
        SELECT (SELECT COUNT(*)::int FROM project WHERE user_id = $1 AND category_id = $2) AS project_count,
               (SELECT COUNT(*)::int FROM todo    WHERE user_id = $1 AND category_id = $2) AS todo_count
        """,
        uid, category_id,
    )
    return CategoryOut(**dict(row), **dict(counts))


async def delete_category(conn: asyncpg.Connection, category_id: UUID, user_id: str) -> dict:
    """Projects and todos keep existing; the FKs are ON DELETE SET NULL, so they
    just go uncategorized."""
    uid = to_uuid(user_id)
    deleted = await conn.fetchval(
        "DELETE FROM category WHERE id = $1 AND user_id = $2 RETURNING id",
        category_id, uid,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"status": "deleted"}
