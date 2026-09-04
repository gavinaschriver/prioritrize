from pydantic import BaseModel, Field
from datetime import datetime, date
from uuid import UUID


class TodoCreate(BaseModel):
    name: str
    point_value: int = Field(default=1, ge=0)
    due_date: date | None = None
    description: str | None = None
    comment: str | None = None
    category_id: UUID | None = None


class TodoUpdate(BaseModel):
    name: str | None = None
    point_value: int | None = Field(default=None, ge=0)
    due_date: date | None = None
    description: str | None = None
    comment: str | None = None
    category_id: UUID | None = None


class TodoConvertToTask(BaseModel):
    project_id: UUID


class TodoOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    point_value: int
    due_date: date | None
    description: str | None
    comment: str | None
    category_id: UUID | None
    #: Short shared number others can point at as "#1042".
    ref_number: int | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
