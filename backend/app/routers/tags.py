from fastapi import APIRouter, Depends
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.tag import TagSuggestion
from app.services import tag_service

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagSuggestion])
async def list_tags(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await tag_service.list_tags(user["id"], conn)
