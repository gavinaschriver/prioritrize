from pydantic import BaseModel
from datetime import date, datetime


class DailyNotesOut(BaseModel):
    content: str
    date: date
    updated_at: datetime


class DailyNotesUpdate(BaseModel):
    content: str
