from pydantic import BaseModel, Field
from datetime import date, datetime
from uuid import UUID


class ProjectCreate(BaseModel):
    name: str
    point_value: int = Field(default=40, ge=40)
    due_date: date
    overview: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    point_value: int | None = Field(default=None, ge=40)
    due_date: date | None = None
    overview: str | None = None


class ProjectUpdateCreate(BaseModel):
    body: str


class ProjectUpdateOut(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    body: str
    created_at: datetime


class ProjectOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    point_value: int
    due_date: date
    overview: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectDetailOut(ProjectOut):
    updates: list[ProjectUpdateOut]
