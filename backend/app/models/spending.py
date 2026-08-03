from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from uuid import UUID


class SpendCreate(BaseModel):
    amount: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    comment: str | None = None
    target_date: str | None = None  # YYYY-MM-DD for backdating


class SpendUpdate(BaseModel):
    """Both fields optional; only the ones actually sent are written.

    `comment: None` is a real value here (clears the comment), so the service
    reads model_fields_set rather than checking for None.
    """
    amount: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    comment: str | None = None


class SpendOut(BaseModel):
    id: UUID
    user_id: UUID
    amount: Decimal
    comment: str | None
    created_at: datetime


class SpendDayOut(BaseModel):
    items: list[SpendOut]
    total: Decimal
