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
    # Undated projects completed today. They score, but they aren't deadlines --
    # they were previously added straight into daily_score and appeared in no
    # subtotal, so the parts didn't sum to the whole on those days.
    rolling: list[DeadlineSummary]
    goals_subtotal: Decimal
    bonuses_subtotal: Decimal
    todos_subtotal: Decimal
    deadlines_subtotal: Decimal
    rolling_subtotal: Decimal
    daily_score: Decimal


class BalanceOut(BaseModel):
    past_total: Decimal
    today_score: Decimal
    current_balance: Decimal


class RecomputeOut(BaseModel):
    """The result of deliberately rescoring a closed day.

    Both breakdowns are returned so the change is auditable: a day can move because
    its inputs genuinely changed (a late entry, a completed todo) or because the
    scoring rules did, and the previous_version tells those apart.
    """
    date: str
    timezone: str
    previous_score: Decimal | None
    new_score: Decimal
    # None when the day had no snapshot at all — a first computation, not a change.
    delta: Decimal | None
    previous_version: int | None
    previous_computed_at: datetime | None
    # None for rows written before breakdowns existed; those days can't be explained.
    previous_breakdown: dict | None
    breakdown: dict
