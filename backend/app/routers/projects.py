from fastapi import APIRouter, Depends
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.project import ProjectCreate, ProjectUpdate, ProjectUpdateCreate, ProjectOut, ProjectDetailOut, ProjectUpdateOut
from app.services import project_service

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.list_projects(conn, user["id"])


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    data: ProjectCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.create_project(conn, user["id"], data)


@router.get("/{project_id}", response_model=ProjectDetailOut)
async def get_project(
    project_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.get_project(conn, project_id, user["id"])


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.update_project(conn, project_id, user["id"], data)


@router.post("/{project_id}/complete", response_model=ProjectOut)
async def complete_project(
    project_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.complete_project(conn, project_id, user["id"])


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.delete_project(conn, project_id, user["id"])


@router.post("/{project_id}/updates", response_model=ProjectUpdateOut, status_code=201)
async def add_update(
    project_id: UUID,
    data: ProjectUpdateCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.add_update(conn, project_id, user["id"], data)
