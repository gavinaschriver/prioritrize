from pydantic import BaseModel, Field
from datetime import date, datetime, time
from uuid import UUID


class ProjectCreate(BaseModel):
    name: str
    point_value: int | None = Field(default=None, ge=0)
    due_date: date | None = None
    overview: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    point_value: int | None = Field(default=None, ge=0)
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


class ProjectTaskCreate(BaseModel):
    name: str
    point_value: int = Field(default=0, ge=0)
    due_date: date | None = None
    # NULL means "use the Google Calendar connection's default_hour".
    due_time: time | None = None


class ProjectTaskUpdate(BaseModel):
    name: str | None = None
    point_value: int | None = Field(default=None, ge=0)
    due_date: date | None = None
    due_time: time | None = None


class ProjectTaskOut(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    name: str
    point_value: int
    due_date: date | None
    due_time: time | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    point_value: int | None
    due_date: date | None
    overview: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectDetailOut(ProjectOut):
    updates: list[ProjectUpdateOut]
    tasks: list[ProjectTaskOut]
