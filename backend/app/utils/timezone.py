from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def get_day_boundaries_utc(date_str: str, tz_str: str) -> tuple[datetime, datetime]:
    """Convert a local date string to UTC midnight boundaries.

    Returns (start_utc, end_utc) where start is inclusive and end is exclusive.
    """
    tz = ZoneInfo(tz_str)
    local_midnight = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=tz)
    next_midnight = local_midnight + timedelta(days=1)
    utc = ZoneInfo("UTC")
    return (local_midnight.astimezone(utc), next_midnight.astimezone(utc))


def get_today_str(tz_str: str) -> str:
    """Get today's date string in the given timezone."""
    tz = ZoneInfo(tz_str)
    return datetime.now(tz).strftime("%Y-%m-%d")
