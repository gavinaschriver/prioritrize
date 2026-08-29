"""Unit tests for _deadline_score, the todo/task/project scoring rule.

The function is pure, so these need no database. The cases that matter most are
the ones under "penalty belongs to the day" -- an item overdue on a given day
must keep that penalty forever, even after it is finally completed. The previous
implementation returned 0 there, which meant clearing a backlog item silently
raised every past day it had been docking and a day could never be recomputed to
the value it was stored with.
"""

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.services.scoring_service import _deadline_score, _effective_due
from app.utils.timezone import get_day_boundaries_utc

TZ = "America/Chicago"

# Real completion instants from production, used by the regression tests below.
# Both are UTC; the local day they land on is the day that earns the points.
WRENCHES_DONE = datetime(2026, 8, 21, 1, 18, 9, tzinfo=timezone.utc)   # 8/20 20:18 local
DRILL_DONE = datetime(2026, 8, 21, 21, 18, 55, tzinfo=timezone.utc)    # 8/21 16:18 local


def score_on(day: str, *, point_value, due_date=None, completed_at=None):
    """Score one item as of `day`, using that day's real UTC boundaries."""
    start_utc, end_utc = get_day_boundaries_utc(day, TZ)
    return _deadline_score(
        point_value,
        date.fromisoformat(due_date) if due_date else None,
        date.fromisoformat(day),
        completed_at,
        start_utc,
        end_utc,
    )


def at(day: str, hour: int):
    """A UTC instant inside `day`'s local window, `hour` hours after local midnight."""
    start_utc, _ = get_day_boundaries_utc(day, TZ)
    return start_utc.replace(hour=(start_utc.hour + hour) % 24)


# --- Earning points on the completion day ---------------------------------

def test_completed_within_the_day_earns_full_value():
    score, upcoming = score_on(
        "2026-08-16", point_value=5, due_date="2026-08-14", completed_at=at("2026-08-16", 12)
    )
    assert score == Decimal(5)
    assert upcoming is False


def test_undated_item_earns_on_completion():
    """An undated item never docks, but still pays out when finished."""
    score, upcoming = score_on(
        "2026-08-16", point_value=30, completed_at=at("2026-08-16", 9)
    )
    assert score == Decimal(30)
    assert upcoming is False


def test_completed_before_its_due_date_still_earns():
    score, _ = score_on(
        "2026-08-16", point_value=10, due_date="2026-08-20", completed_at=at("2026-08-16", 8)
    )
    assert score == Decimal(10)


# --- Items that do not dock ------------------------------------------------

def test_undated_and_incomplete_never_docks():
    score, upcoming = score_on("2026-08-16", point_value=30)
    assert score == Decimal(0)
    assert upcoming is True


def test_not_yet_due_does_not_dock():
    score, upcoming = score_on("2026-08-16", point_value=25, due_date="2026-08-20")
    assert score == Decimal(0)
    assert upcoming is True


# --- Overdue: the penalty belongs to the day -------------------------------

def test_overdue_and_incomplete_docks():
    score, upcoming = score_on("2026-08-16", point_value=5, due_date="2026-08-11")
    assert score == Decimal(-5)
    assert upcoming is False


def test_due_today_and_incomplete_docks():
    """The due date itself counts as overdue -- `due_date > date_obj` is strict."""
    score, _ = score_on("2026-08-19", point_value=15, due_date="2026-08-19")
    assert score == Decimal(-15)


def test_overdue_penalty_survives_a_later_completion():
    """The regression this rule exists for.

    Finishing an item on 8/21 earns its points on 8/21; it does not retroactively
    forgive the days it spent overdue. The old code returned 0 here.
    """
    score, upcoming = score_on(
        "2026-08-16",
        point_value=5,
        due_date="2026-08-11",
        completed_at=at("2026-08-21", 16),
    )
    assert score == Decimal(-5)
    assert upcoming is False


def test_overdue_penalty_repeats_every_day_it_stays_open():
    """Drill holes: 5pt, due 8/11, not finished until 8/21. It docks every day."""
    days = ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18"]
    scores = [
        score_on(d, point_value=5, due_date="2026-08-11", completed_at=DRILL_DONE)[0]
        for d in days
    ]
    assert scores == [Decimal(-5)] * len(days)


# --- Production regressions ------------------------------------------------
# The two items that made 2026-08-19 unreconcilable, with their real timestamps.
# Wrenches is the sharp case: it was overdue by 19 minutes when 8/19's snapshot
# was written, and completing it later used to erase that penalty.

def test_wrenches_docks_on_the_day_it_was_due():
    score, _ = score_on(
        "2026-08-19", point_value=15, due_date="2026-08-19", completed_at=WRENCHES_DONE
    )
    assert score == Decimal(-15)


def test_wrenches_earns_on_its_local_completion_day():
    """Completed 8/21 01:18 UTC, which is 8/20 evening in Chicago -- so 8/20 earns
    it, not 8/21. Getting this wrong is how a day's points land in the wrong bucket.

    Only 8/20 is asserted: from 8/21 onward compute_day_score never calls this
    function for the item at all, because the callers skip anything completed
    before the day starts (scoring_service.py:120, :161, :192).
    """
    assert score_on(
        "2026-08-20", point_value=15, due_date="2026-08-19", completed_at=WRENCHES_DONE
    )[0] == Decimal(15)


def test_august_19_deadline_subtotal_is_minus_twenty():
    """8/19's todo+deadline component: Drill holes -5, Wrenches -15.

    This is what takes a recompute of 8/19 from 240 down to 220.
    """
    drill, _ = score_on(
        "2026-08-19", point_value=5, due_date="2026-08-11", completed_at=DRILL_DONE
    )
    wrenches, _ = score_on(
        "2026-08-19", point_value=15, due_date="2026-08-19", completed_at=WRENCHES_DONE
    )
    assert drill + wrenches == Decimal(-20)


def test_august_15_deadline_subtotal_is_minus_ten():
    """8/15: Drill holes -5, Fix mobile layout -5 -- taking 8/15 from 140 to 130."""
    drill, _ = score_on(
        "2026-08-15", point_value=5, due_date="2026-08-11", completed_at=DRILL_DONE
    )
    mobile, _ = score_on(
        "2026-08-15",
        point_value=5,
        due_date="2026-08-14",
        completed_at=datetime(2026, 8, 17, 1, 18, 43, tzinfo=timezone.utc),
    )
    assert drill + mobile == Decimal(-10)


# --- Zero and null point values --------------------------------------------

@pytest.mark.parametrize("pv", [None, 0])
def test_worthless_items_never_move_the_score(pv):
    """point_value None or 0 must not dock, whatever the due date."""
    assert score_on("2026-08-16", point_value=pv, due_date="2026-08-11")[0] == Decimal(0)
    assert score_on("2026-08-16", point_value=pv)[0] == Decimal(0)


# --- Window boundaries -----------------------------------------------------

def test_completion_at_local_midnight_belongs_to_the_new_day():
    """start_utc is inclusive."""
    start_utc, _ = get_day_boundaries_utc("2026-08-16", TZ)
    score, _ = score_on(
        "2026-08-16", point_value=10, due_date="2026-08-20", completed_at=start_utc
    )
    assert score == Decimal(10)


def test_completion_at_the_next_midnight_belongs_to_the_next_day():
    """end_utc is exclusive, so this is not 8/16's earn -- and since the item was
    due 8/16, 8/16 docks it."""
    _, end_utc = get_day_boundaries_utc("2026-08-16", TZ)
    score, _ = score_on(
        "2026-08-16", point_value=10, due_date="2026-08-16", completed_at=end_utc
    )
    assert score == Decimal(-10)


# --- Effective due dates ---------------------------------------------------
# The floor a deferral leaves behind. Scoring a day against the earlier of the
# item's current date and its floor is what stops a push from refunding the days
# it had already been docking; see test_deferral.py for the composed behaviour.

def test_no_floor_leaves_the_due_date_alone():
    """The overwhelmingly common case: nothing was ever deferred."""
    assert _effective_due(date(2026, 9, 5), None) == date(2026, 9, 5)


def test_a_floor_wins_over_a_date_pushed_past_it():
    assert _effective_due(date(2026, 9, 5), date(2026, 8, 24)) == date(2026, 8, 24)


def test_a_floor_stands_in_for_a_cleared_due_date():
    """Clearing the date is an open-ended deferral, not an escape."""
    assert _effective_due(None, date(2026, 8, 24)) == date(2026, 8, 24)


def test_the_earlier_date_wins_even_when_it_is_the_current_one():
    """A date pulled back in front of its own floor is judged on the pulled-back date."""
    assert _effective_due(date(2026, 8, 20), date(2026, 8, 24)) == date(2026, 8, 20)


def test_an_undeferred_undated_item_has_no_effective_due_date():
    assert _effective_due(None, None) is None
