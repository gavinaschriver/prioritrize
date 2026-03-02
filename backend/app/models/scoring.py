from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class EntryBrief(BaseModel):
    id: UUID
    comment: str | None
    created_at: datetime


class DayPrioritrySummary(BaseModel):
    prioritry_id: UUID
    name: str
    point_value: int
    can_repeat: bool
    comments_enabled: bool
    timeblock: int | None
    entry_count: int
    total_value: Decimal
    entries: list[EntryBrief]


class TodoSummary(BaseModel):
    id: UUID
    name: str
    point_value: int
    completed_at: datetime | None
    score: Decimal


class DaySummary(BaseModel):
    date: str
    timezone: str
    goals: list[DayPrioritrySummary]
    bonuses: list[DayPrioritrySummary]
    todos: list[TodoSummary]
    goals_subtotal: Decimal
    bonuses_subtotal: Decimal
    todos_subtotal: Decimal
    daily_score: Decimal


class BalanceOut(BaseModel):
    past_total: Decimal
    today_score: Decimal
    current_balance: Decimal
