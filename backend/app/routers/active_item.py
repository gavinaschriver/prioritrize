from fastapi import APIRouter, Depends
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.active_item import ActiveItemSet, ActiveItemOut
from app.services import active_item_service

router = APIRouter(prefix="/api/active-item", tags=["active-item"])


@router.get("", response_model=ActiveItemOut | None)
async def get_active_item(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """The item in progress, or null when the bullpen is empty."""
    return await active_item_service.get_active(conn, user["id"])


@router.put("", response_model=ActiveItemOut)
async def set_active_item(
    data: ActiveItemSet,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await active_item_service.set_active(conn, user["id"], data)


@router.delete("")
async def clear_active_item(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await active_item_service.clear_active(conn, user["id"])
