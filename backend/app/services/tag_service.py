import asyncpg
from app.models.tag import TagSuggestion
from app.services.entry_service import to_uuid


# todo.comment and project_task.comment are never exploded into a tag table —
# their tags live only inside the raw string, so they get parsed here. The
# unnest/string_to_array shape is the one proven by the entry_tag backfill in
# 20260421000000_add_entry_tags.sql.
#
# This is slightly looser than entry_service.parse_tags(), which stops at the
# first non-'#' segment; SQL accepts a '#part' anywhere in the comment. For a
# suggestion list that's harmless — it only ever offers more candidates.
_LIST_TAGS_SQL = """
WITH all_tags AS (
    SELECT tag FROM entry_tag WHERE user_id = $1
    UNION ALL
    SELECT tag FROM spend_tag WHERE user_id = $1
    UNION ALL
    SELECT trim(substr(p.part, 2))
    FROM todo t
    CROSS JOIN LATERAL unnest(string_to_array(t.comment, ', ')) AS p(part)
    WHERE t.user_id = $1 AND t.comment IS NOT NULL
      AND p.part LIKE '#%' AND length(trim(substr(p.part, 2))) > 0
    UNION ALL
    SELECT trim(substr(p.part, 2))
    FROM project_task pt
    CROSS JOIN LATERAL unnest(string_to_array(pt.comment, ', ')) AS p(part)
    WHERE pt.user_id = $1 AND pt.comment IS NOT NULL
      AND p.part LIKE '#%' AND length(trim(substr(p.part, 2))) > 0
)
SELECT tag, COUNT(*) AS count
FROM all_tags
GROUP BY tag
ORDER BY count DESC, tag ASC
"""


async def list_tags(user_id: str, conn: asyncpg.Connection) -> list[TagSuggestion]:
    """Every tag the user has ever used, most-used first.

    Deliberately unscoped by date — this feeds autocomplete, not the dashboard.
    """
    rows = await conn.fetch(_LIST_TAGS_SQL, to_uuid(user_id))
    return [TagSuggestion(tag=r["tag"], count=r["count"]) for r in rows]
