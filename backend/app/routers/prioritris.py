from fastapi import APIRouter, Depends, Query
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.prioritri import PrioritriCreate, PrioritriUpdate, PrioritriOut
from app.services import prioritri_service

router = APIRouter(prefix="/api/prioritris", tags=["prioritris"])


@router.get("", response_model=list[PrioritriOut])
async def list_prioritris(
    active_only: bool = Query(True),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritri_service.list_prioritris(user["id"], active_only, conn)


@router.post("", response_model=PrioritriOut, status_code=201)
async def create_prioritri(
    data: PrioritriCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritri_service.create_prioritri(user["id"], data, conn)


@router.put("/{prioritri_id}", response_model=PrioritriOut)
async def update_prioritri(
    prioritri_id: UUID,
    data: PrioritriUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritri_service.update_prioritri(user["id"], prioritri_id, data, conn)


@router.delete("/{prioritri_id}", response_model=PrioritriOut)
async def delete_prioritri(
    prioritri_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await prioritri_service.delete_prioritri(user["id"], prioritri_id, conn)
