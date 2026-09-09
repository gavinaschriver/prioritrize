from pydantic import BaseModel, Field, model_validator
from datetime import datetime, date
from typing import Literal
from uuid import UUID


TemplateKind = Literal["todo", "task"]


class _ScheduleRules(BaseModel):
    """The schedule half of a template, shared by create and update.

    The whole schedule is one interval and an anchor date: "repeat every N days,
    starting <date>". "Every Friday" is every 7 days anchored on a Friday, which
    the date picker already answers -- so there is no weekday set, and no
    day-of-month, and nothing here that can be half-specified.
    """

    #: NULL means no schedule at all -- a manual template you pick from the dropdown.
    repeat_every_days: int | None = Field(default=None, ge=1)
    starts_on: date | None = None
    ends_on: date | None = None

    @model_validator(mode="after")
    def _dates_are_ordered(self):
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("A schedule cannot end before it starts")
        return self


class TemplateCreate(_ScheduleRules):
    name: str
    point_value: int = Field(default=1, ge=0)
    description: str | None = None
    category_id: UUID | None = None
    kind: TemplateKind = "todo"
    #: Required for kind="task", rejected for kind="todo".
    project_id: UUID | None = None

    @model_validator(mode="after")
    def _kind_matches_project(self):
        if self.kind == "task" and self.project_id is None:
            raise ValueError("A task template needs a project")
        if self.kind == "todo" and self.project_id is not None:
            raise ValueError("A todo template cannot belong to a project")
        # Recurrence is todos-only for now; see docs/templates-and-recurrence.md.
        if self.repeat_every_days is not None and self.kind != "todo":
            raise ValueError("Only todo templates can repeat")
        return self


class TemplateUpdate(_ScheduleRules):
    """Every field optional -- `exclude_unset` decides what actually gets written.

    kind and project_id are deliberately absent: a template that changed what it
    builds would orphan the instances it already made. Delete it and make a new one.
    """

    name: str | None = None
    point_value: int | None = Field(default=None, ge=0)
    description: str | None = None
    category_id: UUID | None = None
    paused: bool | None = None


class TemplateInstantiate(BaseModel):
    """Blank is allowed: a dateless todo just sits in the list without docking."""

    due_date: date | None = None


class TemplateOut(BaseModel):
    id: UUID
    user_id: UUID
    kind: TemplateKind
    project_id: UUID | None
    name: str
    point_value: int
    description: str | None
    category_id: UUID | None
    repeat_every_days: int | None
    starts_on: date | None
    ends_on: date | None
    paused: bool
    last_materialized_on: date | None
    created_at: datetime
    updated_at: datetime
