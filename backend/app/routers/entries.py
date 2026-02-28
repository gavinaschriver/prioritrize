from fastapi import APIRouter, Depends, Query
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.entry import EntryCreate, EntryOut
from app.services import entry_service

router = APIRouter(prefix="/api/entries", tags=["entries"])


@router.post("", response_model=EntryOut, status_code=201)
async def create_entry(
    data: EntryCreate,
    tz: str = Query(..., description="User timezone, e.g. America/Chicago"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await entry_service.create_entry(user["id"], data, tz, conn)


@router.delete("/{entry_id}")
async def delete_entry(
    entry_id: UUID,
    tz: str = Query(..., description="User timezone"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await entry_service.delete_entry(user["id"], entry_id, tz, conn)


@router.get("", response_model=list[EntryOut])
async def list_entries(
    date: str = Query(..., description="Date YYYY-MM-DD"),
    tz: str = Query(..., description="User timezone"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await entry_service.list_entries_for_day(user["id"], date, tz, conn)
