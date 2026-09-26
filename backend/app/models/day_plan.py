from pydantic import BaseModel, model_validator
from datetime import datetime, date
from typing import Literal
from uuid import UUID

TimelineSection = Literal["morning", "afternoon", "evening"]
PlanSection = Literal["bank", "dismissed", "morning", "afternoon", "evening"]
#: Sections with no slot numbers: the bank pile, and items hidden for the day.
UNSLOTTED = ("bank", "dismissed")
PlanEntityType = Literal["todo", "project_task", "prioritry", "freeform"]


class PlanBlock(BaseModel):
    """One thing on a day's plan, hydrated with the item it points at.

    `id` is the day_plan_item row. It is None for items that are in the bank only
    because they're due that day -- those are derived, not stored.
    """
    id: UUID | None
    section: PlanSection
    slot_index: int | None
    entity_type: PlanEntityType
    entity_id: UUID | None
    #: The item's name, or the text of a freeform block.
    name: str
    point_value: int | None
    ref_number: int | None
    due_date: date | None
    completed_at: datetime | None
    #: Tasks only -- completing one goes through its project's route.
    project_id: UUID | None
    project_name: str | None
    #: Dailies only: whether an entry is already logged on the plan date.
    logged: bool = False
    #: Dailies only: 'Goal' or 'Bonus'. They sit in separate drawers and colours.
    daily_type: Literal["Goal", "Bonus"] | None = None
    #: Dailies only: can be planned (and logged) more than once a day.
    can_repeat: bool = False
    #: Repeatable dailies in the drawer only: sessions already in a slot that day.
    scheduled_count: int = 0
    #: A scheduled session's specifics ("long walk"). Seeds the log comment.
    note: str | None = None
    #: Dailies only: whether logging takes a comment -- and so whether a note has
    #: anywhere to go.
    comments_enabled: bool = False


class DayPlanOut(BaseModel):
    date: date
    #: Due that day (plus overdue, when the day is today) and anything pulled in via "+ Other".
    bank: list[PlanBlock]
    #: Active dailies not yet placed. Kept apart so the UI can tuck them in a drawer.
    dailies: list[PlanBlock]
    #: Everything on the timeline, in no particular order; section + slot_index position it.
    slots: list[PlanBlock]
    #: Hidden for this day only. Deleting the row brings the item back.
    dismissed: list[PlanBlock]
    #: Slots to render per section: the stored count (default 3), never fewer
    #: than the highest occupied slot + 1.
    slot_counts: dict[TimelineSection, int]


class PlanCandidate(BaseModel):
    """A pending todo or task that could be pulled onto the day via "+ Other"."""
    entity_type: Literal["todo", "project_task"]
    entity_id: UUID
    name: str
    point_value: int | None
    ref_number: int | None
    due_date: date | None
    project_name: str | None


class PlanItemCreate(BaseModel):
    plan_date: date
    section: PlanSection
    slot_index: int | None = None
    entity_type: PlanEntityType
    entity_id: UUID | None = None
    freeform_text: str | None = None
    #: Open a new slot at slot_index (pushing the rest down) instead of taking it.
    insert: bool = False

    @model_validator(mode="after")
    def check_shape(self):
        if self.insert and self.section in UNSLOTTED:
            raise ValueError("insert only applies on the timeline")
        # Mirrors the table's CHECKs so a bad request gets a 422, not a 500.
        if (self.section in UNSLOTTED) != (self.slot_index is None):
            raise ValueError("slot_index is required on the timeline and forbidden in the bank")
        if self.entity_type == "freeform":
            if self.entity_id is not None or self.section in UNSLOTTED:
                raise ValueError("freeform blocks have no entity_id and only live on the timeline")
        elif self.entity_id is None or self.freeform_text is not None:
            raise ValueError("item blocks need an entity_id and no freeform_text")
        return self


class PlanItemMove(BaseModel):
    """Where a stored block should go. If another block is there, they swap."""
    section: PlanSection
    slot_index: int | None = None
    #: Open a new slot at slot_index and close the old one: a reorder, not a swap.
    insert: bool = False
    #: Leaving the timeline, close up the slot left behind rather than keep it empty.
    collapse: bool = False

    @model_validator(mode="after")
    def check_shape(self):
        if (self.section in UNSLOTTED) != (self.slot_index is None):
            raise ValueError("slot_index is required on the timeline and forbidden in the bank")
        if self.insert and self.section in UNSLOTTED:
            raise ValueError("insert only applies on the timeline")
        return self


class PlanItemText(BaseModel):
    freeform_text: str


class PlanItemNote(BaseModel):
    #: Empty or null clears it.
    note: str | None


class SlotRemove(BaseModel):
    """Take one empty slot out of a section; the blocks below it move up."""
    plan_date: date
    section: TimelineSection
    slot_index: int
