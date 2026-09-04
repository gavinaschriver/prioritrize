import asyncpg
from fastapi import HTTPException
from uuid import UUID

from app.models.attachments import AttachmentCreate, AttachmentOut

_COLS = "id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, created_at"


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


async def list_attachments(
    conn: asyncpg.Connection, user_id: str, entity_type: str, entity_id: UUID | None = None
) -> list[AttachmentOut]:
    """One record's files, or every file of that type — a page showing many
    records fetches once instead of once per record."""
    rows = await conn.fetch(
        f"""
        SELECT {_COLS}
        FROM attachment
        WHERE user_id = $1 AND entity_type = $2
          AND ($3::uuid IS NULL OR entity_id = $3)
        ORDER BY created_at ASC
        """,
        to_uuid(user_id), entity_type, entity_id,
    )
    return [AttachmentOut(**dict(r)) for r in rows]


async def create_attachment(
    conn: asyncpg.Connection, user_id: str, data: AttachmentCreate
) -> AttachmentOut:
    uid = to_uuid(user_id)
    # The path is what the storage policies gate on, so a row may only ever point
    # inside the uploader's own folder.
    if not data.storage_path.startswith(f"{uid}/"):
        raise HTTPException(status_code=400, detail="Storage path must live under your own folder")
    row = await conn.fetchrow(
        f"""
        INSERT INTO attachment (user_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING {_COLS}
        """,
        uid, data.entity_type, data.entity_id, data.storage_path,
        data.file_name, data.mime_type, data.size_bytes,
    )
    return AttachmentOut(**dict(row))


async def delete_attachment(conn: asyncpg.Connection, attachment_id: UUID, user_id: str) -> dict:
    """Drops the record and hands back the path, so the caller can drop the file too."""
    row = await conn.fetchrow(
        "DELETE FROM attachment WHERE id = $1 AND user_id = $2 RETURNING storage_path",
        attachment_id, to_uuid(user_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"deleted": True, "storage_path": row["storage_path"]}
