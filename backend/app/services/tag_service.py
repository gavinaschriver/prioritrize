import asyncpg
from app.models.tag import TagSuggestion
from app.services.entry_service import to_uuid


# Todo and project_task tags are never exploded into a tag table — they live
# only inside the raw strings, so they get parsed here. Both text fields are
# scanned: the pre-split tags all sit in `description` now, and either field can
# pick up new ones. concat_ws skips NULLs, so a row with only one of them set
# still works. The unnest/string_to_array shape is the one proven by the
# entry_tag backfill in 20260421000000_add_entry_tags.sql.
#
# This is slightly looser than entry_service.parse_tags(), which stops at the
# first non-'#' segment; SQL accepts a '#part' anywhere in the text. For a
# suggestion list that's harmless — it only ever offers more candidates.
# Only entries and spending explode their tags into tables (entry_tag, spend_tag),
# synced by the application layer. Every other entity keeps its tags inside the
# raw text, so they get parsed here instead: any ', '-separated segment starting
# with '#' counts. concat_ws skips NULLs, so a row with only one field set still
# works. The unnest/string_to_array shape is the one proven by the entry_tag
# backfill in 20260421000000_add_entry_tags.sql.
#
# This is slightly looser than entry_service.parse_tags(), which stops at the
# first non-'#' segment; SQL accepts a '#part' anywhere in the text. For a
# suggestion list that's harmless — it only ever offers more candidates.
_TEXT_TAG_SOURCES = [
    ("todo", "concat_ws(', ', x.description, x.comment)"),
    ("project_task", "concat_ws(', ', x.description, x.comment)"),
    ("project", "concat_ws(', ', x.name, x.overview)"),
    ("project_update", "x.body"),
    ("daily_notes", "x.content"),
    ("prioritry", "x.description"),
    ("scratch_pad", "x.content"),
]

_TEXT_TAG_SQL = "\n    UNION ALL\n".join(
    f"""
    SELECT trim(substr(p.part, 2))
    FROM {table} x
    CROSS JOIN LATERAL unnest(string_to_array({expr}, ', ')) AS p(part)
    WHERE x.user_id = $1
      AND p.part LIKE '#%' AND length(trim(substr(p.part, 2))) > 0
"""
    for table, expr in _TEXT_TAG_SOURCES
)

_LIST_TAGS_SQL = f"""
WITH all_tags AS (
    SELECT tag FROM entry_tag WHERE user_id = $1
    UNION ALL
    SELECT tag FROM spend_tag WHERE user_id = $1
    UNION ALL
{_TEXT_TAG_SQL}
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
