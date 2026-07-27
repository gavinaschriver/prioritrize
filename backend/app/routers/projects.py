from fastapi import APIRouter, BackgroundTasks, Depends
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.project import (
    ProjectCreate, ProjectUpdate, ProjectUpdateCreate,
    ProjectOut, ProjectDetailOut, ProjectUpdateOut,
    ProjectTaskCreate, ProjectTaskUpdate, ProjectTaskOut,
)
from app.services import calendar_sync_service, project_service

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
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.create_project(conn, user["id"], data)
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


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
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.update_project(conn, project_id, user["id"], data)
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.post("/{project_id}/complete", response_model=ProjectOut)
async def complete_project(
    project_id: UUID,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.complete_project(conn, project_id, user["id"])
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.delete_project(conn, project_id, user["id"])
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


# --- Updates ---

@router.post("/{project_id}/updates", response_model=ProjectUpdateOut, status_code=201)
async def add_update(
    project_id: UUID,
    data: ProjectUpdateCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.add_update(conn, project_id, user["id"], data)


@router.put("/{project_id}/updates/{update_id}", response_model=ProjectUpdateOut)
async def edit_update(
    project_id: UUID,
    update_id: UUID,
    data: ProjectUpdateCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.edit_update(conn, update_id, user["id"], data)


@router.delete("/{project_id}/updates/{update_id}")
async def delete_update(
    project_id: UUID,
    update_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await project_service.delete_update(conn, update_id, user["id"])


# --- Tasks ---

@router.post("/{project_id}/tasks", response_model=ProjectTaskOut, status_code=201)
async def create_task(
    project_id: UUID,
    data: ProjectTaskCreate,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.create_task(conn, project_id, user["id"], data)
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.put("/{project_id}/tasks/{task_id}", response_model=ProjectTaskOut)
async def update_task(
    project_id: UUID,
    task_id: UUID,
    data: ProjectTaskUpdate,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.update_task(conn, task_id, user["id"], data)
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.post("/{project_id}/tasks/{task_id}/complete", response_model=ProjectTaskOut)
async def complete_task(
    project_id: UUID,
    task_id: UUID,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.complete_task(conn, task_id, user["id"])
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.delete("/{project_id}/tasks/{task_id}")
async def delete_task(
    project_id: UUID,
    task_id: UUID,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await project_service.delete_task(conn, task_id, user["id"])
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result
