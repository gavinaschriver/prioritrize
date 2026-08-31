"""A day stored under an older SCORING_VERSION must not be rescored by accident.

Version 1 days predate the breakdown column, so the inputs behind them are gone --
is_active, point_value and due_date are all read live. Recomputing one measures it
against today's data, not its own. Measured on the real account: 178 version 1 days
recompute +7343 from input drift against -3164 from the version 2 rules. So an
incidental rescore (re-dating an old todo, backdating an entry) doesn't harmonise
history, it inflates the balance. Only an explicit recompute may cross that line.
"""

import pytest

from app.services import scoring_service
from app.services.scoring_service import SCORING_VERSION, upsert_snapshot

TZ = "America/Chicago"
USER = "b9b2a106-0bb7-414b-a169-c3f792afedda"
DAY = "2026-06-14"


class StubConn:
    """One canned snapshot row; records whether a write was attempted."""

    def __init__(self, row):
        self.row = row
        self.writes = []

    async def fetchrow(self, sql, *args):
        return self.row

    async def execute(self, sql, *args):
        self.writes.append(args)


def snapshot(score=100, finalized=True, version=SCORING_VERSION):
    return {"score": score, "finalized": finalized, "version": version}


@pytest.fixture(autouse=True)
def no_scoring(monkeypatch):
    """compute_day_score needs a real database; the guard must decide before it runs."""
    async def fail(*a, **k):
        raise AssertionError("scored a day it should have left alone")

    monkeypatch.setattr(scoring_service, "compute_day_score", fail)


# --- The guard -------------------------------------------------------------

@pytest.mark.asyncio
async def test_force_does_not_rescore_a_legacy_day():
    """The case that matters: rescore_from sweeping a range back into version 1."""
    conn = StubConn(snapshot(score=-410, version=1))

    result = await upsert_snapshot(USER, DAY, TZ, conn, force=True)

    assert result == -410
    assert conn.writes == []


@pytest.mark.asyncio
async def test_legacy_day_is_left_alone_without_force_too():
    conn = StubConn(snapshot(score=-410, version=1))

    assert await upsert_snapshot(USER, DAY, TZ, conn) == -410
    assert conn.writes == []


@pytest.mark.asyncio
async def test_skipping_a_legacy_day_is_logged(caplog):
    """Silence here looks like 'the rescore worked' when it deliberately didn't."""
    conn = StubConn(snapshot(version=1))

    with caplog.at_level("INFO"):
        await upsert_snapshot(USER, DAY, TZ, conn, force=True)

    assert DAY in caplog.text
    assert "version 1" in caplog.text


@pytest.mark.asyncio
async def test_current_version_day_is_still_immutable_without_force():
    conn = StubConn(snapshot(score=120))

    assert await upsert_snapshot(USER, DAY, TZ, conn) == 120
    assert conn.writes == []


# --- The sanctioned escape hatch -------------------------------------------

@pytest.mark.asyncio
async def test_allow_legacy_lets_an_explicit_recompute_through(monkeypatch):
    """POST /days/{date}/recompute returns both breakdowns, so the change is auditable."""
    conn = StubConn(snapshot(score=-410, version=1))
    scored = []

    async def fake_score(user_id, date_str, tz_str, c):
        scored.append(date_str)
        return _summary(-280)

    monkeypatch.setattr(scoring_service, "compute_day_score", fake_score)

    result = await upsert_snapshot(
        USER, DAY, TZ, conn, force=True, allow_legacy=True
    )

    assert result == -280
    assert scored == [DAY]
    assert len(conn.writes) == 1


@pytest.mark.asyncio
async def test_allow_legacy_still_respects_an_unforced_call(monkeypatch):
    """allow_legacy relaxes the version check, not the finalized check."""
    conn = StubConn(snapshot(score=-410, version=1))

    assert await upsert_snapshot(USER, DAY, TZ, conn, allow_legacy=True) == -410
    assert conn.writes == []


# --- Rows the guard must not block -----------------------------------------

@pytest.mark.asyncio
async def test_unfinalized_legacy_row_is_rewritten(monkeypatch):
    """An unfinalized row was written mid-day and never closed out -- it was never a
    record of anything, so the backfill should still finish it."""
    conn = StubConn(snapshot(score=50, finalized=False, version=1))
    monkeypatch.setattr(
        scoring_service, "compute_day_score",
        lambda *a, **k: _coro(_summary(90)),
    )

    assert await upsert_snapshot(USER, DAY, TZ, conn) == 90
    assert len(conn.writes) == 1


@pytest.mark.asyncio
async def test_missing_day_is_written(monkeypatch):
    conn = StubConn(None)
    monkeypatch.setattr(
        scoring_service, "compute_day_score",
        lambda *a, **k: _coro(_summary(15)),
    )

    assert await upsert_snapshot(USER, DAY, TZ, conn) == 15
    assert len(conn.writes) == 1


# --- helpers ---------------------------------------------------------------

async def _coro(value):
    return value


def _summary(score):
    """Minimal stand-in: upsert_snapshot only reads daily_score and hands the
    summary to build_breakdown."""
    from app.models.scoring import DaySummary

    return DaySummary(
        date=DAY, timezone=TZ, goals=[], bonuses=[], todos=[], deadlines=[], rolling=[],
        goals_subtotal=0, bonuses_subtotal=0, todos_subtotal=0,
        deadlines_subtotal=0, rolling_subtotal=0, daily_score=score,
    )
