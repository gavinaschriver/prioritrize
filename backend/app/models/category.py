from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str


class CategoryOut(BaseModel):
    """An evergreen bucket shared by projects and todos.

    A project is "Install L-track"; its category is "Vehicle Work". Todos take
    the same categories -- they're free-radical micro projects.
    """
    id: UUID
    user_id: UUID
    name: str
    created_at: datetime
    updated_at: datetime
    #: How many of the user's projects currently sit under this category.
    project_count: int = 0
    #: How many of the user's todos currently sit under this category.
    todo_count: int = 0
