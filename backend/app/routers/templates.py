from fastapi import APIRouter, Depends, Query
from uuid import UUID
import asyncpg
from app.auth import get_current_user
from app.database import get_conn
from app.models.item_template import (
    TemplateCreate, TemplateUpdate, TemplateOut, TemplateInstantiate,
)
from app.deps import get_timezone
from app.services import template_service

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    kind: str | None = Query(None, description="Filter to 'todo' or 'task'"),
    project_id: UUID | None = Query(None, description="Task templates for one project"),
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await template_service.list_templates(conn, user["id"], kind, project_id)


@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(
    data: TemplateCreate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
    tz: str = Depends(get_timezone),
):
    # tz is what stamps starts_on for a recurring template, so "every other Monday"
    # counts from the user's today rather than a UTC one.
    return await template_service.create_template(conn, user["id"], data, tz)


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: UUID,
    data: TemplateUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await template_service.update_template(conn, template_id, user["id"], data)


@router.delete("/{template_id}")
async def delete_template(
    template_id: UUID,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await template_service.delete_template(conn, template_id, user["id"])


@router.post("/{template_id}/instantiate", status_code=201)
async def instantiate_template(
    template_id: UUID,
    data: TemplateInstantiate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Turn a blueprint into one real todo or task, due whenever the caller says.

    No response_model: this returns a TodoOut or a ProjectTaskOut depending on the
    template's kind, and pinning either one would silently drop the other's fields.
    """
    return await template_service.instantiate(conn, user["id"], template_id, data.due_date)
