from fastapi import APIRouter, Depends
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.category import CategoryCreate, CategoryUpdate, CategoryOut
from app.services import category_service

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await category_service.list_categories(conn, user["id"])


@router.post("", response_model=CategoryOut, status_code=201)
async def create_category(
    data: CategoryCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await category_service.create_category(conn, user["id"], data)


@router.put("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await category_service.update_category(conn, category_id, user["id"], data)


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await category_service.delete_category(conn, category_id, user["id"])
