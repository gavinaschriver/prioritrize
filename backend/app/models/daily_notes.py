from pydantic import BaseModel
from datetime import date, datetime
from uuid import UUID


class DailyNotesOut(BaseModel):
    id: UUID
    content: str
    date: date
    updated_at: datetime


class DailyNotesUpdate(BaseModel):
    content: str
