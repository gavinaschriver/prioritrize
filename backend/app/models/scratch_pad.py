from pydantic import BaseModel
from datetime import datetime


class ScratchPadOut(BaseModel):
    content: str
    updated_at: datetime


class ScratchPadUpdate(BaseModel):
    content: str
