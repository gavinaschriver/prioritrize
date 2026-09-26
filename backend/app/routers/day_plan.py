from fastapi import APIRouter, Depends, Query
import asyncpg
from datetime import date
from uuid import UUID
from app.auth import get_current_user
from app.database import get_conn
from app.models.day_plan import (
    DayPlanOut, PlanCandidate, PlanItemCreate, PlanItemMove, PlanItemNote, PlanItemText, SlotRemove,
)
from app.services import day_plan_service

router = APIRouter(prefix="/api/day-plan", tags=["day-plan"])


@router.get("", response_model=DayPlanOut)
async def get_day_plan(
    date: date = Query(..., description="Date YYYY-MM-DD"),
    tz: str = Query(..., description="User timezone, e.g. America/Chicago"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await day_plan_service.get_day_plan(conn, user["id"], date, tz)


@router.get("/candidates", response_model=list[PlanCandidate])
async def get_candidates(
    date: date = Query(..., description="Date YYYY-MM-DD"),
    tz: str = Query(..., description="User timezone"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Pending todos and tasks not already on this day -- the "+ Other" list."""
    return await day_plan_service.get_candidates(conn, user["id"], date, tz)


@router.post("/items")
async def create_item(
    data: PlanItemCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await day_plan_service.create_item(conn, user["id"], data)


@router.patch("/items/{item_id}/move")
async def move_item(
    item_id: UUID,
    data: PlanItemMove,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await day_plan_service.move_item(conn, user["id"], item_id, data)


@router.patch("/items/{item_id}/text")
async def update_text(
    item_id: UUID,
    data: PlanItemText,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await day_plan_service.update_text(conn, user["id"], item_id, data.freeform_text)


@router.patch("/items/{item_id}/note")
async def update_note(
    item_id: UUID,
    data: PlanItemNote,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """What a scheduled session will be, specifically. Seeds the log comment."""
    return await day_plan_service.update_note(conn, user["id"], item_id, data.note)


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: UUID,
    collapse: bool = Query(False, description="Also close up the slot it sat in"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await day_plan_service.delete_item(conn, user["id"], item_id, collapse)


@router.post("/sections/remove-slot")
async def remove_slot(
    data: SlotRemove,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Close up an empty slot; the blocks below it move up one."""
    return await day_plan_service.remove_slot(conn, user["id"], data)
