from pydantic import BaseModel, Field
from datetime import datetime


class GoogleConnectRequest(BaseModel):
    timezone: str = "UTC"
    redirect_path: str = "/settings"


class GoogleConnectOut(BaseModel):
    authorization_url: str


class GoogleSettingsUpdate(BaseModel):
    timezone: str | None = None
    default_hour: int | None = Field(default=None, ge=0, le=23)
    default_duration_minutes: int | None = Field(default=None, gt=0)
    reminder_minutes: list[int] | None = None
    roll_forward: bool | None = None


class GoogleConnectionOut(BaseModel):
    """Everything the Settings page needs. Deliberately carries no tokens."""

    connected: bool
    status: str | None = None
    google_account_email: str | None = None
    calendar_id: str | None = None
    timezone: str | None = None
    default_hour: int | None = None
    default_duration_minutes: int | None = None
    reminder_minutes: list[int] | None = None
    roll_forward: bool | None = None
    last_synced_at: datetime | None = None
    last_error: str | None = None
    synced_event_count: int = 0


class SyncResultOut(BaseModel):
    synced: bool
    created: int = 0
    updated: int = 0
    deleted: int = 0
    unchanged: int = 0
    api_calls: int = 0
    status: str | None = None
    error: str | None = None
