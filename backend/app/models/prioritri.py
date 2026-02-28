from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID


class PrioritriCreate(BaseModel):
    name: str
    type_id: int
    point_value: int
    can_repeat: bool = True
    timeblock: int | None = None
    comments_enabled: bool = False
    extra_penalty: int = 0

    @field_validator("point_value")
    @classmethod
    def point_value_positive(cls, v):
        if v <= 0:
            raise ValueError("point_value must be positive")
        return v

    @field_validator("extra_penalty")
    @classmethod
    def extra_penalty_non_negative(cls, v):
        if v < 0:
            raise ValueError("extra_penalty must be non-negative")
        return v


class PrioritriUpdate(BaseModel):
    name: str | None = None
    type_id: int | None = None
    point_value: int | None = None
    can_repeat: bool | None = None
    timeblock: int | None = None
    comments_enabled: bool | None = None
    extra_penalty: int | None = None

    @field_validator("point_value")
    @classmethod
    def point_value_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("point_value must be positive")
        return v


class PrioritriOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    type_id: int
    type_name: str
    point_value: int
    can_repeat: bool
    timeblock: int | None
    comments_enabled: bool
    extra_penalty: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
