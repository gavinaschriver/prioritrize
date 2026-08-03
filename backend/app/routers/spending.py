from fastapi import APIRouter, Depends, Query
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.spending import SpendCreate, SpendUpdate, SpendOut, SpendDayOut
from app.services import spending_service

router = APIRouter(prefix="/api/spending", tags=["spending"])


@router.get("", response_model=SpendDayOut)
async def list_spending(
    date: str = Query(..., description="Date YYYY-MM-DD"),
    tz: str = Query(..., description="User timezone"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await spending_service.list_spend_for_day(user["id"], date, tz, conn)


@router.post("", response_model=SpendOut, status_code=201)
async def create_spending(
    data: SpendCreate,
    tz: str = Query(..., description="User timezone, e.g. America/Chicago"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await spending_service.create_spend(user["id"], data, tz, conn)


@router.patch("/{spend_id}", response_model=SpendOut)
async def update_spending(
    spend_id: UUID,
    data: SpendUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await spending_service.update_spend(user["id"], spend_id, data, conn)


@router.delete("/{spend_id}")
async def delete_spending(
    spend_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await spending_service.delete_spend(user["id"], spend_id, conn)
