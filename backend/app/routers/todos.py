from fastapi import APIRouter, BackgroundTasks, Depends
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.todo import TodoCreate, TodoUpdate, TodoOut
from app.services import calendar_sync_service, todo_service

router = APIRouter(prefix="/api/todos", tags=["todos"])


@router.get("", response_model=list[TodoOut])
async def list_todos(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await todo_service.list_todos(conn, user["id"])


@router.post("", response_model=TodoOut, status_code=201)
async def create_todo(
    data: TodoCreate,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await todo_service.create_todo(conn, user["id"], data)
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.put("/{todo_id}", response_model=TodoOut)
async def update_todo(
    todo_id: UUID,
    data: TodoUpdate,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await todo_service.update_todo(conn, todo_id, user["id"], data)
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.post("/{todo_id}/complete", response_model=TodoOut)
async def complete_todo(
    todo_id: UUID,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await todo_service.complete_todo(conn, todo_id, user["id"])
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result


@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: UUID,
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await todo_service.delete_todo(conn, todo_id, user["id"])
    background.add_task(calendar_sync_service.sync_user_bg, user["id"])
    return result
