from fastapi import APIRouter, Depends, Query
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.prioritry import PrioritryCreate, PrioritryUpdate, PrioritryOut
from app.services import prioritry_service

router = APIRouter(prefix="/api/prioritries", tags=["prioritries"])


@router.get("", response_model=list[PrioritryOut])
async def list_prioritries(
    active_only: bool = Query(True),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritry_service.list_prioritries(user["id"], active_only, conn)


@router.post("", response_model=PrioritryOut, status_code=201)
async def create_prioritry(
    data: PrioritryCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritry_service.create_prioritry(user["id"], data, conn)


@router.put("/{prioritry_id}", response_model=PrioritryOut)
async def update_prioritry(
    prioritry_id: UUID,
    data: PrioritryUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritry_service.update_prioritry(user["id"], prioritry_id, data, conn)


@router.delete("/{prioritry_id}", response_model=PrioritryOut)
async def delete_prioritry(
    prioritry_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritry_service.delete_prioritry(user["id"], prioritry_id, conn)
