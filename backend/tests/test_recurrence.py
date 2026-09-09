"""Tests for recurring-todo generation.

Two independent things live in template_service and are tested separately here.

`latest_occurrence_on_or_before` is interval arithmetic: given "every N days from
this anchor" and a date, when did it last fire?

`materialize_due_recurrences` is policy: only-the-latest, one-open-at-a-time, and
idempotence. Those tests stub the arithmetic out entirely, because a bug in the
counting must not be able to fail a policy test and send you looking in the wrong
place.
"""

from datetime import date

import pytest

from app.models.item_template import TemplateOut
from app.services import template_service
from app.services.template_service import (
    next_occurrence,
    materialize_due_recurrences,
)

TZ = "America/Chicago"
USER = "b9b2a106-0bb7-414b-a169-c3f792afedda"
TEMPLATE_ID = "3f7c1b6e-2a5d-4c8f-9e10-7b2d4a6c8e01"


def make_template(**over) -> TemplateOut:
    base = dict(
        id=TEMPLATE_ID, user_id=USER, kind="todo", project_id=None,
        name="take out the trash", point_value=2, description=None, category_id=None,
        repeat_every_days=1, starts_on=date(2026, 9, 1), ends_on=None, paused=False,
        last_materialized_on=None,
        created_at="2026-09-01T00:00:00+00:00", updated_at="2026-09-01T00:00:00+00:00",
    )
    return TemplateOut(**{**base, **over})


# --- The interval ---------------------------------------------------------

def test_a_future_start_is_produced_immediately():
    """The calendar rule: saving "every Saturday" on a Wednesday must put Saturday's
    todo in the queue now, dated Saturday -- not leave the tracker looking untouched
    until Saturday arrives."""
    t = make_template(repeat_every_days=7, starts_on=date(2026, 9, 12))
    assert next_occurrence(t, date(2026, 9, 9)) == date(2026, 9, 12)


def test_the_anchor_is_itself_an_occurrence():
    t = make_template(repeat_every_days=5, starts_on=date(2026, 9, 8))
    assert next_occurrence(t, date(2026, 9, 8)) == date(2026, 9, 8)


def test_finishing_one_rolls_on_to_the_next():
    """Completed Sep 12, asked the same day: the answer is Sep 19, not Sep 12 again."""
    t = make_template(repeat_every_days=7, starts_on=date(2026, 9, 12),
                      last_materialized_on=date(2026, 9, 12))
    assert next_occurrence(t, date(2026, 9, 12)) == date(2026, 9, 19)


def test_it_never_produces_a_date_in_the_past():
    """Two weeks away. The next trash-taking is the coming one -- the missed ones are
    not a debt, and three overdue todos would dock the day you came back once each."""
    t = make_template(repeat_every_days=7, starts_on=date(2026, 9, 12),
                      last_materialized_on=date(2026, 9, 12))
    assert next_occurrence(t, date(2026, 9, 25)) == date(2026, 9, 26)


def test_it_counts_from_the_anchor_not_the_calendar():
    """Every 3 days from Sep 1 is the 1st, 4th, 7th, 10th -- not "every 3rd"."""
    t = make_template(repeat_every_days=3, starts_on=date(2026, 9, 1))
    assert next_occurrence(t, date(2026, 9, 8)) == date(2026, 9, 10)


def test_it_strides_across_a_month_boundary():
    t = make_template(repeat_every_days=3, starts_on=date(2026, 8, 28))
    assert next_occurrence(t, date(2026, 9, 8)) == date(2026, 9, 9)


def test_every_seven_days_is_every_friday():
    """The whole reason there is no weekday concept: anchor on a Friday and the
    interval keeps landing on Fridays, across month and year boundaries alike."""
    friday = date(2026, 9, 4)
    assert friday.strftime("%a") == "Fri"
    t = make_template(repeat_every_days=7, starts_on=friday)
    for asked, expected in [
        (date(2026, 9, 4), date(2026, 9, 4)),     # the anchor Friday itself
        (date(2026, 9, 5), date(2026, 9, 11)),    # Saturday: the coming Friday
        (date(2026, 12, 26), date(2027, 1, 1)),   # months on, still a Friday
    ]:
        got = next_occurrence(t, asked)
        assert got == expected, f"asked {asked}: got {got}, wanted {expected}"
        assert got.strftime("%a") == "Fri"


def test_a_retired_schedule_produces_nothing():
    t = make_template(repeat_every_days=7, starts_on=date(2026, 9, 12),
                      ends_on=date(2026, 9, 30))
    assert next_occurrence(t, date(2026, 10, 1)) is None


def test_a_template_with_no_interval_never_fires():
    """A manual template is the same row with no schedule -- it must never be
    generated, only picked from the dropdown."""
    t = make_template(repeat_every_days=None, starts_on=date(2026, 9, 1))
    assert next_occurrence(t, date(2026, 9, 8)) is None


# --- The policy --------------------------------------------------------

class StubConn:
    """Canned template rows and open-instance answers; records every write."""

    def __init__(self, rows, still_open=False):
        self.rows = rows
        self.still_open = still_open
        self.executed = []

    async def fetch(self, sql, *args):
        return self.rows

    async def fetchval(self, sql, *args):
        return 1 if self.still_open else None

    async def execute(self, sql, *args):
        self.executed.append((sql, args))


@pytest.fixture
def generator(monkeypatch):
    """Pin 'today', stub the arithmetic, and capture every todo created."""
    created = []

    async def fake_create_todo(conn, user_id, data):
        created.append(data)
        return type("T", (), {"id": f"todo-{len(created)}"})()

    monkeypatch.setattr(template_service, "get_today_str", lambda tz: "2026-09-08")
    monkeypatch.setattr(
        template_service.todo_service, "create_todo", fake_create_todo)
    monkeypatch.setattr(
        template_service, "next_occurrence", lambda t, today: date(2026, 9, 8))
    return created


def _row(**over):
    return make_template(**over).model_dump()


@pytest.mark.asyncio
async def test_a_due_recurrence_produces_one_todo(generator):
    conn = StubConn([_row()])
    made = await materialize_due_recurrences(conn, USER, TZ)
    assert len(made) == 1
    assert generator[0].name == "take out the trash"
    assert generator[0].due_date == date(2026, 9, 8)


@pytest.mark.asyncio
async def test_running_twice_produces_nothing_the_second_time(generator):
    """Safe to call on every page load, which it is -- once per day-summary load.

    Two guards make it idempotent and this exercises the first: the todo the first
    pass created is open, so the second pass declines. The second guard lives inside
    next_occurrence, which floors at last_materialized_on + 1 and is covered by
    test_finishing_one_rolls_on_to_the_next.
    """
    conn = StubConn([_row()])
    await materialize_due_recurrences(conn, USER, TZ)

    # What the world looks like immediately after: watermark set, instance open.
    settled = StubConn([_row(last_materialized_on=date(2026, 9, 8))], still_open=True)
    assert await materialize_due_recurrences(settled, USER, TZ) == []
    assert len(generator) == 1


@pytest.mark.asyncio
async def test_a_week_away_owes_one_todo_not_seven(generator):
    """Missed occurrences are not a debt -- next_occurrence never looks back, so a
    gap in the watermark can only ever yield the one upcoming date."""
    conn = StubConn([_row(last_materialized_on=date(2026, 9, 1))])
    made = await materialize_due_recurrences(conn, USER, TZ)
    assert len(made) == 1


@pytest.mark.asyncio
async def test_an_open_occurrence_blocks_the_next(generator):
    """One open occurrence per series, so the queue never fills with identical rows.
    An unfinished chore just goes overdue; the next appears once it is done."""
    conn = StubConn([_row()], still_open=True)
    assert await materialize_due_recurrences(conn, USER, TZ) == []
    assert generator == []
    assert conn.executed == []


@pytest.mark.asyncio
async def test_nothing_is_made_when_the_series_is_finished(generator, monkeypatch):
    """next_occurrence returning None (retired, paused past its end, no anchor) has
    to stop the generator rather than fall through to a create."""
    monkeypatch.setattr(template_service, "next_occurrence", lambda t, today: None)
    conn = StubConn([_row()])
    assert await materialize_due_recurrences(conn, USER, TZ) == []
    assert generator == []
