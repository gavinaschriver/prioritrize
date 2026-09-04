from fastapi import APIRouter, Depends
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.project import (
    ProjectCategoryCreate, ProjectCategoryUpdate, ProjectCategoryOut,
)
from app.services import project_service

# Its own prefix rather than /api/projects/categories, which would be shadowed
# by the /api/projects/{project_id} route.
router = APIRouter(prefix="/api/project-categories", tags=["project-categories"])


@router.get("", response_model=list[ProjectCategoryOut])
async def list_categories(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.list_categories(conn, user["id"])


@router.post("", response_model=ProjectCategoryOut, status_code=201)
async def create_category(
    data: ProjectCategoryCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.create_category(conn, user["id"], data)


@router.put("/{category_id}", response_model=ProjectCategoryOut)
async def update_category(
    category_id: UUID,
    data: ProjectCategoryUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.update_category(conn, category_id, user["id"], data)


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.delete_category(conn, category_id, user["id"])
