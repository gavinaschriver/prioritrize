from pydantic import BaseModel
from uuid import UUID


class PrioritryStats(BaseModel):
    prioritry_id: UUID
    name: str
    type_name: str
    timeblock: int | None
    entry_count: int
    total_minutes: int | None  # entry_count * timeblock if timeblock, else None


class TodoStats(BaseModel):
    id: UUID
    name: str
    completed_in_range: bool


class TagStats(BaseModel):
    tag: str
    count: int


class DashboardOut(BaseModel):
    start: str
    end: str
    prioritry_stats: list[PrioritryStats]
    todo_stats: list[TodoStats]
    tag_stats: list[TagStats]
