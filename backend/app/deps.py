from fastapi import Header, Query
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TZ = "UTC"


def get_timezone(
    tz: str | None = Query(None, description="User timezone, e.g. America/Chicago"),
    x_timezone: str | None = Header(None, alias="X-Timezone"),
) -> str:
    """The caller's timezone, for routes that need to know which local day a change
    lands in.

    Read routes pass ?tz= explicitly; mutations get it from the X-Timezone header
    the frontend sets on every request, so that scoring-relevant writes don't each
    need a query param threaded through the client.

    An unknown zone falls back to UTC rather than 500ing -- a mangled header should
    not be able to block a todo from being deleted.
    """
    candidate = tz or x_timezone
    if not candidate:
        return DEFAULT_TZ
    try:
        ZoneInfo(candidate)
    except (ZoneInfoNotFoundError, ValueError):
        return DEFAULT_TZ
    return candidate
