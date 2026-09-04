from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal
from uuid import UUID

# Everything that can carry a file. Dailies (goals/bonuses) are deliberately
# absent: they're a score for a day, not a thing with a paper trail.
EntityType = Literal['todo', 'project', 'project_task', 'project_update', 'daily_note']

# Matches the bucket's own limit, so an oversized file is refused here rather
# than after it has been pushed across the wire.
MAX_SIZE_BYTES = 25 * 1024 * 1024


class AttachmentOut(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    storage_path: str
    file_name: str
    mime_type: str | None
    size_bytes: int
    created_at: datetime


class AttachmentCreate(BaseModel):
    """Recorded after the browser has put the bytes in the bucket."""
    entity_type: EntityType
    entity_id: UUID
    storage_path: str
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str | None = None
    size_bytes: int = Field(ge=0, le=MAX_SIZE_BYTES)
