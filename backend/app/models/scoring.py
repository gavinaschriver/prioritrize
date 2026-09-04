from pydantic import BaseModel, computed_field
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
    #: Read-only here -- the detail modal shows it, the Dailies page edits it.
    description: str | None = None
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
    description: str | None = None
    comment: str | None = None
    category_id: UUID | None = None

    # The due date this day was actually scored against. Differs from due_date only
    # when the item was deferred out from under this day -- see _effective_due.
    effective_due_date: date | None = None

    @computed_field
    @property
    def deferred(self) -> bool:
        """This day's dock is owed to a deferral, not to the item's current due date.

        Without it the row shows a negative score beside a due date that hasn't
        arrived yet, which reads as a bug rather than a locked-in penalty.
        """
        return self.score < 0 and self.effective_due_date != self.due_date


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
    description: str | None = None
    comment: str | None = None

    # The due date this day was actually scored against. Differs from due_date only
    # when the item was deferred out from under this day -- see _effective_due.
    effective_due_date: date | None = None

    @computed_field
    @property
    def deferred(self) -> bool:
        """This day's dock is owed to a deferral, not to the item's current due date.

        Without it the row shows a negative score beside a due date that hasn't
        arrived yet, which reads as a bug rather than a locked-in penalty.
        """
        return self.score < 0 and self.effective_due_date != self.due_date


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


class WrapUpOut(BaseModel):
    """Whether the user has declared themselves finished logging a given day.

    Server-side so the state is the same on every device, rather than a
    per-browser dismissal that has to be clicked away once per phone and laptop.
    """
    date: str
    # None means the day is still open for logging.
    wrapped_up_at: datetime | None
