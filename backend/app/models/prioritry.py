from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID


class PrioritryCreate(BaseModel):
    name: str
    type_id: int
    point_value: int
    can_repeat: bool = True
    timeblock: int | None = None
    comments_enabled: bool = False
    description: str | None = None

    @field_validator("point_value")
    @classmethod
    def point_value_non_negative(cls, v):
        if v < 0:
            raise ValueError("point_value must be 0 or greater")
        return v


class PrioritryUpdate(BaseModel):
    name: str | None = None
    type_id: int | None = None
    point_value: int | None = None
    can_repeat: bool | None = None
    timeblock: int | None = None
    comments_enabled: bool | None = None
    description: str | None = None

    @field_validator("point_value")
    @classmethod
    def point_value_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("point_value must be 0 or greater")
        return v


class PrioritryOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    type_id: int
    type_name: str
    point_value: int
    can_repeat: bool
    timeblock: int | None
    comments_enabled: bool
    #: Standing notes on the routine itself, edited from the Dailies page.
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
