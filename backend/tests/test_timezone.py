"""Regression tests for local-day bucketing.

get_day_boundaries_utc looks like it should break across DST -- it adds a whole
timedelta(days=1) to an aware datetime -- but it doesn't: ZoneInfo arithmetic is
wall-clock, and astimezone() then resolves the offset from the *resulting* wall
time. These tests exist so nobody "fixes" that into a real bug.

What must hold is tiling: consecutive days share a boundary exactly, so every
entry falls in exactly one day. A gap loses entries from the score; an overlap
counts them twice.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.utils.timezone import get_day_boundaries_utc, get_today_str

CHI = "America/Chicago"


def span_hours(day: str, tz: str = CHI) -> float:
    start, end = get_day_boundaries_utc(day, tz)
    return (end - start).total_seconds() / 3600


# --- Day length across DST -------------------------------------------------

def test_ordinary_day_is_24_hours():
    assert span_hours("2026-08-19") == 24


def test_spring_forward_day_is_23_hours():
    """2026-03-08: clocks jump 02:00 -> 03:00, so the local day is an hour short."""
    assert span_hours("2026-03-08") == 23


def test_fall_back_day_is_25_hours():
    """2026-11-01: 01:00-02:00 happens twice."""
    assert span_hours("2026-11-01") == 25


def test_days_around_a_transition_are_normal():
    assert span_hours("2026-03-07") == 24
    assert span_hours("2026-03-09") == 24
    assert span_hours("2026-10-31") == 24
    assert span_hours("2026-11-02") == 24


# --- Tiling ----------------------------------------------------------------

@pytest.mark.parametrize(
    "day,next_day",
    [
        ("2026-08-19", "2026-08-20"),   # ordinary
        ("2026-03-08", "2026-03-09"),   # spring forward
        ("2026-11-01", "2026-11-02"),   # fall back
    ],
)
def test_consecutive_days_share_a_boundary(day, next_day):
    """No gap, no overlap: an entry belongs to exactly one day."""
    assert get_day_boundaries_utc(day, CHI)[1] == get_day_boundaries_utc(next_day, CHI)[0]


def test_a_week_across_the_spring_transition_tiles_without_holes():
    days = [f"2026-03-{d:02d}" for d in range(5, 12)]
    bounds = [get_day_boundaries_utc(d, CHI) for d in days]
    for (_, end), (start, _) in zip(bounds, bounds[1:]):
        assert end == start
    total = (bounds[-1][1] - bounds[0][0]).total_seconds() / 3600
    assert total == 7 * 24 - 1  # one hour lost to the transition


# --- Offsets ---------------------------------------------------------------

def test_boundaries_are_utc_and_ordered():
    start, end = get_day_boundaries_utc("2026-08-19", CHI)
    assert start.tzinfo is not None and end.tzinfo is not None
    assert start.utcoffset() == timedelta(0)
    assert start < end


def test_summer_and_winter_days_start_at_different_utc_hours():
    """CDT is UTC-5, CST is UTC-6 -- the same local midnight is a different instant."""
    assert get_day_boundaries_utc("2026-08-19", CHI)[0] == datetime(
        2026, 8, 19, 5, tzinfo=timezone.utc
    )
    assert get_day_boundaries_utc("2026-01-19", CHI)[0] == datetime(
        2026, 1, 19, 6, tzinfo=timezone.utc
    )


def test_half_hour_offset_zone():
    """Not every zone is a whole number of hours off UTC."""
    start, _ = get_day_boundaries_utc("2026-08-19", "Asia/Kolkata")
    assert start == datetime(2026, 8, 18, 18, 30, tzinfo=timezone.utc)


def test_utc_is_its_own_local_day():
    start, end = get_day_boundaries_utc("2026-08-19", "UTC")
    assert start == datetime(2026, 8, 19, tzinfo=timezone.utc)
    assert end == datetime(2026, 8, 20, tzinfo=timezone.utc)


# --- Today -----------------------------------------------------------------

def test_get_today_str_is_a_parseable_date():
    from datetime import date
    assert date.fromisoformat(get_today_str(CHI))


def test_today_differs_by_zone_near_the_dateline():
    """Two users mid-call can be on different calendar days; the snapshot's stored
    timezone is what makes a day's score interpretable later."""
    assert get_today_str("Pacific/Kiritimati") >= get_today_str("Pacific/Midway")
