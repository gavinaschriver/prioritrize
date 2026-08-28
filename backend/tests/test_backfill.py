"""Tests for the snapshot backfill.

The gap-finding SQL is exercised against the real database; what's pinned here is
the logic around it -- the guards that decide whether to run at all, the order
days are written in, and the cap that stops a dormant account from turning one
page load into hundreds of scoring passes.
"""

from datetime import date, timedelta

import pytest

from app.services import scoring_service
from app.services.scoring_service import (
    BACKFILL_LIMIT_DAYS,
    backfill_snapshots,
    find_unsnapshotted_days,
)

TZ = "America/Chicago"
# find_unsnapshotted_days parses this, so it has to be a real UUID.
USER = "b9b2a106-0bb7-414b-a169-c3f792afedda"


class StubConn:
    """Returns canned results; records nothing. The SQL itself is verified live."""

    def __init__(self, first_active=None, missing=()):
        self.first_active = first_active
        self.missing = list(missing)

    async def fetchval(self, sql, *args):
        return self.first_active

    async def fetch(self, sql, *args):
        return [{"day": d} for d in self.missing]


@pytest.fixture
def written(monkeypatch):
    """Capture the days upsert_snapshot is asked to write, in order."""
    days = []

    async def fake_upsert(user_id, date_str, tz_str, conn, force=False):
        days.append(date_str)
        return 0

    monkeypatch.setattr(scoring_service, "upsert_snapshot", fake_upsert)
    return days


def stub_days(monkeypatch, days):
    async def fake_find(user_id, tz_str, conn):
        return list(days)

    monkeypatch.setattr(scoring_service, "find_unsnapshotted_days", fake_find)


# --- Guards ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_user_with_no_entries_is_skipped():
    """min(created_at) is NULL for a brand-new account; don't scan from epoch."""
    assert await find_unsnapshotted_days(USER, TZ, StubConn(first_active=None)) == []


@pytest.mark.asyncio
async def test_first_entry_today_leaves_nothing_to_close():
    """A user whose history starts today has no closed day yet."""
    today = date.today()
    conn = StubConn(first_active=today + timedelta(days=1))
    assert await find_unsnapshotted_days(USER, TZ, conn) == []


@pytest.mark.asyncio
async def test_no_gaps_writes_nothing(monkeypatch, written):
    stub_days(monkeypatch, [])
    assert await backfill_snapshots(USER, TZ, None) == []
    assert written == []


# --- Ordering --------------------------------------------------------------

@pytest.mark.asyncio
async def test_days_are_written_oldest_first(monkeypatch, written):
    """Each day is scored independently, but writing in order keeps the log
    readable and matches the order the balance sums them in."""
    gaps = [date(2026, 5, 1), date(2026, 5, 24), date(2026, 6, 10), date(2026, 6, 20)]
    stub_days(monkeypatch, gaps)

    result = await backfill_snapshots(USER, TZ, None)

    assert written == ["2026-05-01", "2026-05-24", "2026-06-10", "2026-06-20"]
    assert result == gaps


@pytest.mark.asyncio
async def test_backfill_fills_holes_in_the_middle_of_history(monkeypatch, written):
    """The production gaps sat before the newest snapshot, not after it. Walking
    forward from max(date) would have missed them entirely."""
    stub_days(monkeypatch, [date(2026, 5, 24), date(2026, 6, 10)])

    await backfill_snapshots(USER, TZ, None)

    assert written == ["2026-05-24", "2026-06-10"]


# --- The cap ---------------------------------------------------------------

@pytest.mark.asyncio
async def test_under_the_cap_everything_is_written(monkeypatch, written):
    gaps = [date(2026, 1, 1) + timedelta(days=i) for i in range(BACKFILL_LIMIT_DAYS)]
    stub_days(monkeypatch, gaps)

    await backfill_snapshots(USER, TZ, None)

    assert len(written) == BACKFILL_LIMIT_DAYS


@pytest.mark.asyncio
async def test_over_the_cap_keeps_the_most_recent_days(monkeypatch, written):
    """The recent past is what the user is looking at, so drop from the old end."""
    gaps = [date(2026, 1, 1) + timedelta(days=i) for i in range(BACKFILL_LIMIT_DAYS + 10)]
    stub_days(monkeypatch, gaps)

    result = await backfill_snapshots(USER, TZ, None)

    assert len(written) == BACKFILL_LIMIT_DAYS
    assert result[0] == gaps[10]
    assert result[-1] == gaps[-1]


@pytest.mark.asyncio
async def test_truncation_is_logged_not_silent(monkeypatch, written, caplog):
    """A silently truncated backfill reads as 'balance is complete' when it isn't."""
    gaps = [date(2026, 1, 1) + timedelta(days=i) for i in range(BACKFILL_LIMIT_DAYS + 3)]
    stub_days(monkeypatch, gaps)

    with caplog.at_level("WARNING"):
        await backfill_snapshots(USER, TZ, None)

    assert "backfill capped" in caplog.text
    assert "2026-01-01" in caplog.text
