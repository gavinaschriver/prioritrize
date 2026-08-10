from pydantic import BaseModel


class TagSuggestion(BaseModel):
    tag: str
    count: int
