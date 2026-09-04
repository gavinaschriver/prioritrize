from pydantic import BaseModel
from datetime import datetime
from typing import Literal
from uuid import UUID

ActiveEntityType = Literal["todo", "project_task"]


class ActiveItemSet(BaseModel):
    entity_type: ActiveEntityType
    entity_id: UUID


class ActiveItemOut(BaseModel):
    """The one thing in progress right now, or nothing."""
    entity_type: ActiveEntityType
    entity_id: UUID
    started_at: datetime
