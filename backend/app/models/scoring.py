from pydantic import BaseModel
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class EntryBrief(BaseModel):
    id: UUID
    comment: str | None
    created_at: datetime
    quantity: int = 1  # how many timeblocks this single entry represents


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
    due_date: date | None
    completed_at: datetime | None
    created_at: datetime
    score: Decimal
    is_upcoming: bool
    comment: str | None = None


class DeadlineSummary(BaseModel):
    id: UUID
    type: str  # 'project' | 'task'
    name: str
    project_id: UUID | None  # tasks only
    project_name: str | None  # tasks only
    point_value: int | None
    due_date: date | None
    created_at: datetime
    completed_at: datetime | None
    score: Decimal
    is_upcoming: bool
    comment: str | None = None


class DaySummary(BaseModel):
    date: str
    timezone: str
    goals: list[DayPrioritrySummary]
    bonuses: list[DayPrioritrySummary]
    todos: list[TodoSummary]
    deadlines: list[DeadlineSummary]
    goals_subtotal: Decimal
    bonuses_subtotal: Decimal
    todos_subtotal: Decimal
    deadlines_subtotal: Decimal
    daily_score: Decimal


class BalanceOut(BaseModel):
    past_total: Decimal
    today_score: Decimal
    current_balance: Decimal
