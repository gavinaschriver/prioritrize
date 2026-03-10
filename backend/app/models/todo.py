from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class TodoCreate(BaseModel):
    name: str
    point_value: int = Field(default=1, ge=0)


class TodoUpdate(BaseModel):
    name: str | None = None
    point_value: int | None = Field(default=None, ge=0)


class TodoOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    point_value: int
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
