from pydantic import BaseModel, Field
from datetime import datetime, date, time
from uuid import UUID


class TodoCreate(BaseModel):
    name: str
    point_value: int = Field(default=1, ge=0)
    due_date: date | None = None
    # NULL means "use the Google Calendar connection's default_hour".
    due_time: time | None = None


class TodoUpdate(BaseModel):
    name: str | None = None
    point_value: int | None = Field(default=None, ge=0)
    due_date: date | None = None
    due_time: time | None = None


class TodoOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    point_value: int
    due_date: date | None
    due_time: time | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
