from fastapi import APIRouter, Depends, HTTPException, Query
import asyncpg
from datetime import date as date_cls
from app.auth import get_current_user
from app.database import get_conn
from app.models.scoring import DaySummary, BalanceOut, RecomputeOut
from app.services import scoring_service
from app.utils.timezone import get_today_str

router = APIRouter(prefix="/api/days", tags=["days"])


@router.get("/summary", response_model=DaySummary)
async def day_summary(
    date: str = Query(..., description="Date YYYY-MM-DD"),
    tz: str = Query(..., description="User timezone, e.g. America/Chicago"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    # Close out any past day that never got a snapshot
    await scoring_service.backfill_snapshots(user["id"], tz, conn)
    return await scoring_service.compute_day_score(user["id"], date, tz, conn)


@router.get("/balance", response_model=BalanceOut)
async def balance(
    tz: str = Query(..., description="User timezone"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await scoring_service.get_balance(user["id"], tz, conn)


@router.post("/{date}/recompute", response_model=RecomputeOut)
async def recompute(
    date: str,
    tz: str = Query(..., description="User timezone, e.g. America/Chicago"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Rescore a day after its inputs changed, and report what moved.

    Closed days are otherwise immutable, so this is the deliberate escape hatch --
    use it after logging something late, not as a routine refresh.
    """
    try:
        day = date_cls.fromisoformat(date)
    except ValueError:
        raise HTTPException(400, "Date must be YYYY-MM-DD")

    if day > date_cls.fromisoformat(get_today_str(tz)):
        raise HTTPException(400, "Cannot score a day that hasn't happened yet")

    return await scoring_service.recompute_day(user["id"], date, tz, conn)
