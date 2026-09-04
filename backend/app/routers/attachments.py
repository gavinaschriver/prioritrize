from fastapi import APIRouter, Depends, Query
from uuid import UUID
import asyncpg

from app.auth import get_current_user
from app.database import get_conn
from app.models.attachments import AttachmentCreate, AttachmentOut, EntityType
from app.services import attachment_service

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


@router.get("", response_model=list[AttachmentOut])
async def list_attachments(
    entity_type: EntityType = Query(...),
    entity_id: UUID | None = Query(None, description="Omit for every record of this type"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await attachment_service.list_attachments(conn, user["id"], entity_type, entity_id)


@router.post("", response_model=AttachmentOut)
async def create_attachment(
    data: AttachmentCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await attachment_service.create_attachment(conn, user["id"], data)


@router.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await attachment_service.delete_attachment(conn, attachment_id, user["id"])
