from fastapi import APIRouter, Depends, Query
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.daily_notes import DailyNotesOut, DailyNotesUpdate
from app.services import daily_notes_service

router = APIRouter(prefix="/api/daily-notes", tags=["daily-notes"])

# test workflow

@router.get("", response_model=DailyNotesOut)
async def get_daily_notes(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await daily_notes_service.get_daily_notes(conn, user["id"], date)


@router.put("", response_model=DailyNotesOut)
async def update_daily_notes(
    data: DailyNotesUpdate,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await daily_notes_service.update_daily_notes(conn, user["id"], date, data)
