from pydantic import BaseModel
from datetime import datetime
from typing import Literal
from uuid import UUID


class ItemRefOut(BaseModel):
    """What a "#1042" in someone's notes actually points at."""
    ref_number: int
    entity_type: Literal["todo", "project_task"]
    entity_id: UUID
    name: str
    #: Set for tasks; the detail sheet needs it to load the parent project.
    project_id: UUID | None
    completed_at: datetime | None
