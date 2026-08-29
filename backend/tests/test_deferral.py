"""Tests for the procrastination penalty: what happens when a due date is pushed.

Moving a due date forward used to refund every past day the item had been docking.
rescore_from recomputes closed days from live data, and _deadline_score only ever
saw the item's current date, so dragging a deadline out was the cheapest way to
erase a week of red days -- the exact behaviour the app exists to discourage.

A deferral now leaves a floor: the date the item held when it was pushed. Scoring
answers to the earlier of floor and current date, so the days already burned stay
burned while later days answer to the new deadline.

record_deferral is deliberately narrow. Deleting an item is a "won't do" -- the work
stopped existing rather than being put off -- and is not a deferral.

fetch_due_floors' SQL is not exercised here (this suite has no database); floor_on
below models the same MIN/GROUP BY so the composition can be tested.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.services import scoring_service
from app.services.scoring_service import _deadline_score, _effective_due, record_deferral
from app.utils.timezone import get_day_boundaries_utc

TZ = "America/Chicago"
USER = "b9b2a106-0bb7-414b-a169-c3f792afedda"
ITEM = "3f6c1d20-9e5b-4a77-8c11-2d0a5b7e4c33"

# "change tires", 10 pts, due 8/24, pushed to 9/5 on 8/26.
TIRES = [("2026-08-24", "2026-08-26")]  # (previous_due_date, deferred_on)


def floor_on(day: str, deferrals) -> str | None:
    """MIN(previous_due_date) over deferrals recorded on or after `day`.

    The python twin of what fetch_due_floors asks the database for.
    """
    d = date.fromisoformat(day)
    prior = [p for p, on in deferrals if date.fromisoformat(on) >= d]
    return min(prior) if prior else None


def score_on(day: str, *, point_value, current_due, deferrals=(), completed_at=None):
    """Score one item as of `day`, with whatever floor its deferrals leave that day."""
    start_utc, end_utc = get_day_boundaries_utc(day, TZ)
    floor = floor_on(day, deferrals)
    effective = _effective_due(
        date.fromisoformat(current_due) if current_due else None,
        date.fromisoformat(floor) if floor else None,
    )
    score, _ = _deadline_score(
        point_value, effective, date.fromisoformat(day), completed_at, start_utc, end_utc
    )
    return score


# --- The days already burned stay burned -----------------------------------

@pytest.mark.parametrize("day", ["2026-08-24", "2026-08-25", "2026-08-26"])
def test_every_day_it_was_already_docking_keeps_its_penalty(day):
    """The whole point: pushing 8/24 out to 9/5 must not refund 8/24 through 8/26."""
    assert score_on(day, point_value=10, current_due="2026-09-05", deferrals=TIRES) == Decimal(-10)


def test_the_day_of_the_deferral_is_charged_too():
    """Deferred on 8/26 while already overdue, so 8/26 is a day of delay like any other.

    This is the day the user is standing in when they push the date, and it is the
    one a naive implementation refunds instantly.
    """
    assert score_on("2026-08-26", point_value=10, current_due="2026-09-05", deferrals=TIRES) == Decimal(-10)


@pytest.mark.parametrize("day", ["2026-08-27", "2026-09-01", "2026-09-04"])
def test_the_new_buffer_is_clean(day):
    """Between the deferral and the new date nothing is owed -- that is the buffer."""
    assert score_on(day, point_value=10, current_due="2026-09-05", deferrals=TIRES) == Decimal(0)


@pytest.mark.parametrize("day", ["2026-09-05", "2026-09-06"])
def test_the_new_due_date_docks_normally_once_it_arrives(day):
    assert score_on(day, point_value=10, current_due="2026-09-05", deferrals=TIRES) == Decimal(-10)


@pytest.mark.parametrize("day", ["2026-08-22", "2026-08-23"])
def test_days_before_the_original_due_date_owe_nothing(day):
    """The floor is a due date, not a blanket penalty: it still has to arrive."""
    assert score_on(day, point_value=10, current_due="2026-09-05", deferrals=TIRES) == Decimal(0)


# --- Clearing a due date ---------------------------------------------------

def test_clearing_a_due_date_keeps_the_days_it_had_been_docking():
    """An open-ended deferral is still a deferral: the delay was taken either way."""
    assert score_on("2026-08-25", point_value=10, current_due=None, deferrals=TIRES) == Decimal(-10)


def test_a_cleared_due_date_never_docks_again_afterwards():
    """Once the floor is behind us there is no date left to be overdue against."""
    assert score_on("2026-09-30", point_value=10, current_due=None, deferrals=TIRES) == Decimal(0)


# --- Chained deferrals -----------------------------------------------------

# Due 8/10, pushed to 8/20 on 8/12, pushed again to 9/1 on 8/22.
CHAIN = [("2026-08-10", "2026-08-12"), ("2026-08-20", "2026-08-22")]


@pytest.mark.parametrize(
    "day,expected",
    [
        ("2026-08-10", -10),  # originally due
        ("2026-08-12", -10),  # first deferral, still overdue against 8/10
        ("2026-08-13", 0),    # inside the first buffer
        ("2026-08-19", 0),
        ("2026-08-20", -10),  # the first new date arrived and was missed
        ("2026-08-22", -10),  # second deferral, overdue against 8/20
        ("2026-08-23", 0),    # inside the second buffer
        ("2026-09-01", -10),  # the second new date arrives
    ],
)
def test_chained_deferrals_compose(day, expected):
    """Two pushes leave two burned stretches and two clean buffers.

    MIN over deferrals recorded on or after the day is what makes this work with no
    special casing: on 8/13 only the 8/22 deferral is still ahead, so the floor is
    8/20 rather than the original 8/10.
    """
    assert score_on(day, point_value=10, current_due="2026-09-01", deferrals=CHAIN) == Decimal(expected)


# --- Completing it late ----------------------------------------------------

def test_completing_a_deferred_item_still_earns_on_the_day_it_is_done():
    """The floor docks the days that passed; it does not block the eventual payoff."""
    start_utc, _ = get_day_boundaries_utc("2026-09-10", TZ)
    done = start_utc.replace(hour=start_utc.hour + 3)
    assert score_on(
        "2026-09-10", point_value=10, current_due="2026-09-05",
        deferrals=TIRES, completed_at=done,
    ) == Decimal(10)


# --- record_deferral: is this change actually procrastination? --------------

class RecordingConn:
    """Captures the INSERT record_deferral makes, if it makes one."""

    def __init__(self):
        self.executed = []

    async def execute(self, sql, *args):
        self.executed.append(args)


def row(*, due_date, completed_at=None):
    return {"due_date": date.fromisoformat(due_date) if due_date else None,
            "completed_at": completed_at}


@pytest.fixture
def today(monkeypatch):
    """Pin the user's local today, which is what "already due" is measured against."""
    def _set(day):
        monkeypatch.setattr(scoring_service, "get_today_str", lambda tz_str: day)
    return _set


async def defer(conn, before, new_due, tz=TZ):
    return await record_deferral(
        conn, USER, "todo", ITEM, before,
        date.fromisoformat(new_due) if new_due else None, tz,
    )


@pytest.mark.asyncio
async def test_pushing_an_overdue_date_is_recorded(today):
    today("2026-08-26")
    conn = RecordingConn()
    assert await defer(conn, row(due_date="2026-08-24"), "2026-09-05") is True
    args = conn.executed[0]
    assert args[1] == "todo"
    assert args[3] == date(2026, 8, 24)  # previous_due_date -- the floor
    assert args[4] == date(2026, 9, 5)   # new_due_date
    assert args[5] == date(2026, 8, 26)  # deferred_on, the user's local day


@pytest.mark.asyncio
async def test_pushing_something_due_today_is_recorded(today):
    """Due today counts as due. _deadline_score docks the due date itself, so a
    same-day push is already avoiding a penalty that is being charged."""
    today("2026-08-24")
    conn = RecordingConn()
    assert await defer(conn, row(due_date="2026-08-24"), "2026-09-05") is True


@pytest.mark.asyncio
async def test_clearing_an_overdue_date_is_recorded(today):
    today("2026-08-26")
    conn = RecordingConn()
    assert await defer(conn, row(due_date="2026-08-24"), None) is True
    assert conn.executed[0][4] is None


@pytest.mark.asyncio
async def test_an_item_not_due_yet_is_not_procrastination(today):
    """Re-planning ahead of a deadline avoids no work that was owed."""
    today("2026-08-20")
    conn = RecordingConn()
    assert await defer(conn, row(due_date="2026-08-24"), "2026-09-05") is False
    assert conn.executed == []


@pytest.mark.asyncio
async def test_pulling_a_date_earlier_is_not_procrastination(today):
    """Committing to a sooner deadline is the opposite of putting it off."""
    today("2026-08-26")
    conn = RecordingConn()
    assert await defer(conn, row(due_date="2026-08-24"), "2026-08-20") is False
    assert conn.executed == []


@pytest.mark.asyncio
async def test_a_push_that_lands_still_in_the_past_is_recorded(today):
    """8/24 -> 8/25 with today at 8/26 buys exactly one day of relief, and is a
    deferral for that day. The floor keeps 8/24; 8/25 and 8/26 go on docking
    against the new date anyway, so nothing is double-charged."""
    today("2026-08-26")
    conn = RecordingConn()
    assert await defer(conn, row(due_date="2026-08-24"), "2026-08-25") is True
    assert conn.executed[0][3] == date(2026, 8, 24)


@pytest.mark.asyncio
async def test_a_completed_item_has_nothing_left_to_defer(today):
    from datetime import datetime, timezone as tzmod
    today("2026-08-26")
    conn = RecordingConn()
    done = datetime(2026, 8, 25, 12, tzinfo=tzmod.utc)
    assert await defer(conn, row(due_date="2026-08-24", completed_at=done), "2026-09-05") is False
    assert conn.executed == []


@pytest.mark.asyncio
async def test_giving_an_undated_item_a_date_is_not_procrastination(today):
    """Nothing was owed, so nothing was avoided -- this is planning, not delay."""
    today("2026-08-26")
    conn = RecordingConn()
    assert await defer(conn, row(due_date=None), "2026-09-05") is False
    assert conn.executed == []
