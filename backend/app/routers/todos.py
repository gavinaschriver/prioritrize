from fastapi import APIRouter, Depends
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.todo import TodoCreate, TodoUpdate, TodoOut, TodoConvertToTask
from app.models.project import ProjectTaskOut
from app.services import todo_service

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
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await todo_service.create_todo(conn, user["id"], data)


@router.put("/{todo_id}", response_model=TodoOut)
async def update_todo(
    todo_id: UUID,
    data: TodoUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await todo_service.update_todo(conn, todo_id, user["id"], data)


@router.post("/{todo_id}/complete", response_model=TodoOut)
async def complete_todo(
    todo_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await todo_service.complete_todo(conn, todo_id, user["id"])


@router.post("/{todo_id}/uncomplete", response_model=TodoOut)
async def uncomplete_todo(
    todo_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await todo_service.uncomplete_todo(conn, todo_id, user["id"])


@router.post("/{todo_id}/convert-to-task", response_model=ProjectTaskOut)
async def convert_todo_to_task(
    todo_id: UUID,
    data: TodoConvertToTask,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await todo_service.convert_to_task(conn, todo_id, user["id"], data.project_id)


@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await todo_service.delete_todo(conn, todo_id, user["id"])
