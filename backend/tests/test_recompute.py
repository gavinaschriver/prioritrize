"""Tests for recompute_day, the only sanctioned overwrite of a closed day.

What matters here is the report it produces. A recompute that just changes the
number is how the 2026-08-14..19 snapshots became unexplainable; this one has to
say what the day was worth before, when that was computed, and under which
scoring version.
"""

import json
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.services import scoring_service
from app.services.scoring_service import recompute_day

TZ = "America/Chicago"
USER = "b9b2a106-0bb7-414b-a169-c3f792afedda"

NEW_BREAKDOWN = {"schema": 1, "date": "2026-08-18", "daily_score": "-160"}
OLD_BREAKDOWN = {"schema": 1, "date": "2026-08-18", "daily_score": "-190"}


class StubConn:
    """Serves fetchrow results in call order: the 'before' row, then the 'after'."""

    def __init__(self, before, after):
        self.results = [before, after]

    async def fetchrow(self, sql, *args):
        return self.results.pop(0)


@pytest.fixture
def scored(monkeypatch):
    """Make upsert_snapshot return a fixed new score without touching a database."""

    def _set(score):
        async def fake_upsert(user_id, date_str, tz_str, conn, force=False):
            assert force is True, "recompute must be able to overwrite a finalized day"
            return Decimal(score)

        monkeypatch.setattr(scoring_service, "upsert_snapshot", fake_upsert)

    return _set


# --- Reporting the change --------------------------------------------------

@pytest.mark.asyncio
async def test_reports_the_delta_against_the_stored_score(scored):
    scored(-160)
    conn = StubConn(
        before={
            "score": Decimal(-190),
            "breakdown": json.dumps(OLD_BREAKDOWN),
            "version": 1,
            "computed_at": datetime(2026, 8, 19, 14, tzinfo=timezone.utc),
        },
        after={"breakdown": json.dumps(NEW_BREAKDOWN)},
    )

    out = await recompute_day(USER, "2026-08-18", TZ, conn)

    assert out.previous_score == Decimal(-190)
    assert out.new_score == Decimal(-160)
    assert out.delta == Decimal(30)


@pytest.mark.asyncio
async def test_first_computation_has_no_delta(scored):
    """A day that never had a snapshot isn't a change, so delta stays None rather
    than pretending the day used to be worth zero."""
    scored(-275)
    conn = StubConn(before=None, after={"breakdown": json.dumps(NEW_BREAKDOWN)})

    out = await recompute_day(USER, "2026-05-01", TZ, conn)

    assert out.previous_score is None
    assert out.delta is None
    assert out.new_score == Decimal(-275)


@pytest.mark.asyncio
async def test_previous_version_is_reported(scored):
    """Distinguishes 'the data moved' from 'the scoring rules moved'."""
    scored(220)
    conn = StubConn(
        before={
            "score": Decimal(235),
            "breakdown": json.dumps(OLD_BREAKDOWN),
            "version": 1,
            "computed_at": datetime(2026, 8, 21, 1, 37, tzinfo=timezone.utc),
        },
        after={"breakdown": json.dumps(NEW_BREAKDOWN)},
    )

    out = await recompute_day(USER, "2026-08-19", TZ, conn)

    assert out.previous_version == 1
    assert out.previous_computed_at == datetime(2026, 8, 21, 1, 37, tzinfo=timezone.utc)
    assert out.delta == Decimal(-15)


# --- Breakdown handling ----------------------------------------------------

@pytest.mark.asyncio
async def test_breakdowns_are_parsed_not_returned_as_text(scored):
    """asyncpg hands jsonb back as a string unless a codec is registered."""
    scored(-160)
    conn = StubConn(
        before={
            "score": Decimal(-190), "breakdown": json.dumps(OLD_BREAKDOWN),
            "version": 2, "computed_at": datetime(2026, 8, 19, tzinfo=timezone.utc),
        },
        after={"breakdown": json.dumps(NEW_BREAKDOWN)},
    )

    out = await recompute_day(USER, "2026-08-18", TZ, conn)

    assert out.previous_breakdown == OLD_BREAKDOWN
    assert out.breakdown == NEW_BREAKDOWN


@pytest.mark.asyncio
async def test_already_decoded_jsonb_passes_through(scored):
    """If a json codec is ever registered, don't double-parse."""
    scored(-160)
    conn = StubConn(
        before={
            "score": Decimal(-190), "breakdown": OLD_BREAKDOWN,
            "version": 2, "computed_at": datetime(2026, 8, 19, tzinfo=timezone.utc),
        },
        after={"breakdown": NEW_BREAKDOWN},
    )

    out = await recompute_day(USER, "2026-08-18", TZ, conn)

    assert out.previous_breakdown == OLD_BREAKDOWN


@pytest.mark.asyncio
async def test_legacy_row_has_no_previous_breakdown(scored):
    """The 11 snapshots written before this work have breakdown NULL. The
    recompute still reports their score -- it just can't explain it."""
    scored(220)
    conn = StubConn(
        before={
            "score": Decimal(235), "breakdown": None,
            "version": 1, "computed_at": datetime(2026, 8, 21, 1, 37, tzinfo=timezone.utc),
        },
        after={"breakdown": json.dumps(NEW_BREAKDOWN)},
    )

    out = await recompute_day(USER, "2026-08-19", TZ, conn)

    assert out.previous_breakdown is None
    assert out.previous_score == Decimal(235)
    assert out.breakdown == NEW_BREAKDOWN
