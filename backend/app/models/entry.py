from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class EntryCreate(BaseModel):
    prioritry_id: UUID
    comment: str | None = None
    target_date: str | None = None  # YYYY-MM-DD for backdating


class EntryUpdate(BaseModel):
    comment: str | None = None


class EntryOut(BaseModel):
    id: UUID
    prioritry_id: UUID
    user_id: UUID
    prioritry_name: str | None = None
    comment: str | None
    created_at: datetime
