from fastapi import APIRouter, Depends, Query
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.scoring import DaySummary, BalanceOut
from app.services import scoring_service

router = APIRouter(prefix="/api/days", tags=["days"])


@router.get("/summary", response_model=DaySummary)
async def day_summary(
    date: str = Query(..., description="Date YYYY-MM-DD"),
    tz: str = Query(..., description="User timezone, e.g. America/Chicago"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    # Finalize yesterday's snapshot if needed
    await scoring_service.finalize_yesterday(user["id"], tz, conn)
    return await scoring_service.compute_day_score(user["id"], date, tz, conn)


@router.get("/balance", response_model=BalanceOut)
async def balance(
    tz: str = Query(..., description="User timezone"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await scoring_service.get_balance(user["id"], tz, conn)
