from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class EntryCreate(BaseModel):
    prioritri_id: UUID
    comment: str | None = None
    target_date: str | None = None  # YYYY-MM-DD for backdating


class EntryOut(BaseModel):
    id: UUID
    prioritri_id: UUID
    user_id: UUID
    prioritri_name: str | None = None
    comment: str | None
    created_at: datetime
