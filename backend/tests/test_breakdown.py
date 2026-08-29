"""Tests for build_breakdown, the audit record frozen into daily_snapshot.

The breakdown exists so a stored score can be told apart from a later recompute
of the same day. That only works if it is complete (every line that moved the
score is in it), lossless (no float rounding), and self-consistent (its subtotals
add up to the score it claims).
"""

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.models.scoring import (
    DayPrioritrySummary,
    DaySummary,
    DeadlineSummary,
    TodoSummary,
)
from app.services.scoring_service import build_breakdown


def goal(name, pv, entry_count):
    value = Decimal(pv) * entry_count if entry_count else -Decimal(pv)
    return DayPrioritrySummary(
        prioritry_id=uuid4(), name=name, point_value=pv, can_repeat=True,
        comments_enabled=False, timeblock=None, entry_count=entry_count,
        total_value=value, entries=[],
    )


def todo(name, pv, score, due=None, completed=None, effective=...):
    # effective defaults to due, which is what compute_day_score sets on anything
    # that was never deferred. Pass it explicitly to model an item that was.
    eff = due if effective is ... else effective
    return TodoSummary(
        id=uuid4(), name=name, point_value=pv,
        due_date=date.fromisoformat(due) if due else None,
        effective_due_date=date.fromisoformat(eff) if eff else None,
        completed_at=completed, created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        score=Decimal(score), is_upcoming=(score == 0),
    )


def deadline(name, pv, score, due=None, completed=None, effective=...):
    eff = due if effective is ... else effective
    return DeadlineSummary(
        id=uuid4(), type="task", name=name, project_id=uuid4(), project_name="P",
        point_value=pv, due_date=date.fromisoformat(due) if due else None,
        effective_due_date=date.fromisoformat(eff) if eff else None,
        created_at=datetime(2026, 8, 1, tzinfo=timezone.utc), completed_at=completed,
        score=Decimal(score), is_upcoming=(score == 0),
    )


def summary(**over):
    """A day with one logged goal, one missed goal, a bonus and an overdue todo."""
    fields = dict(
        date="2026-08-19", timezone="America/Chicago",
        goals=[goal("Exercise", 25, 2), goal("Garden tending", 15, 0)],
        bonuses=[goal("Laundry", 10, 1)],
        todos=[todo("Drill holes", 5, -5, due="2026-08-11")],
        deadlines=[],
        rolling=[],
        goals_subtotal=Decimal(35), bonuses_subtotal=Decimal(10),
        todos_subtotal=Decimal(-5), deadlines_subtotal=Decimal(0),
        rolling_subtotal=Decimal(0), daily_score=Decimal(40),
    )
    fields.update(over)
    return DaySummary(**fields)


# --- Completeness ----------------------------------------------------------

def test_logged_and_unlogged_goals_are_separated():
    b = build_breakdown(summary())
    assert [g["name"] for g in b["goals_logged"]] == ["Exercise"]
    assert [g["name"] for g in b["goals_unlogged"]] == ["Garden tending"]


def test_unlogged_goal_records_its_penalty():
    """The missed-goal penalty is usually the biggest driver of a bad day and the
    least reconstructible, since it comes from goals that have no entry at all."""
    (missed,) = build_breakdown(summary())["goals_unlogged"]
    assert missed["value"] == "-15"
    assert missed["entry_count"] == 0


def test_quantity_is_recorded_not_just_the_total():
    """entry_count is what makes a 50-point Exercise line explicable."""
    (logged,) = build_breakdown(summary())["goals_logged"]
    assert logged["entry_count"] == 2
    assert logged["value"] == "50"


def test_scoring_lines_are_kept_and_inert_ones_dropped():
    b = build_breakdown(summary(
        todos=[todo("Drill holes", 5, -5, due="2026-08-11"),
               todo("Reminders", 25, 0, due="2026-09-01")],
    ))
    assert [t["name"] for t in b["todos"]] == ["Drill holes"]


def test_rolling_projects_appear_in_their_own_bucket():
    """Rolling projects used to be added to daily_score and shown in no subtotal."""
    b = build_breakdown(summary(
        rolling=[deadline("Utility shelf", 50, 50,
                          completed=datetime(2026, 8, 19, 20, tzinfo=timezone.utc))],
        rolling_subtotal=Decimal(50), daily_score=Decimal(90),
    ))
    assert [r["name"] for r in b["rolling"]] == ["Utility shelf"]
    assert b["subtotals"]["rolling"] == "50"


# --- Self-consistency ------------------------------------------------------

def test_subtotals_add_up_to_the_daily_score():
    b = build_breakdown(summary(
        rolling=[deadline("Utility shelf", 50, 50,
                          completed=datetime(2026, 8, 19, 20, tzinfo=timezone.utc))],
        deadlines=[deadline("Wrenches", 15, -15, due="2026-08-19")],
        rolling_subtotal=Decimal(50), deadlines_subtotal=Decimal(-15),
        daily_score=Decimal(75),
    ))
    total = sum(Decimal(v) for v in b["subtotals"].values())
    assert total == Decimal(b["daily_score"]) == Decimal(75)


def test_goal_lines_add_up_to_the_goals_subtotal():
    b = build_breakdown(summary())
    lines = sum(Decimal(g["value"]) for g in b["goals_logged"] + b["goals_unlogged"])
    assert lines == Decimal(b["subtotals"]["goals"]) == Decimal(35)


# --- Storage ---------------------------------------------------------------

def test_breakdown_is_json_serialisable():
    """It goes into a jsonb column via json.dumps, so nothing exotic may survive."""
    b = build_breakdown(summary(
        deadlines=[deadline("Wrenches", 15, -15, due="2026-08-19",
                            completed=datetime(2026, 8, 21, 1, 18, tzinfo=timezone.utc))],
        deadlines_subtotal=Decimal(-15), daily_score=Decimal(25),
    ))
    assert json.loads(json.dumps(b)) == b


def test_decimals_are_strings_so_json_cannot_round_them():
    b = build_breakdown(summary(
        goals_subtotal=Decimal("35.5"), daily_score=Decimal("40.5"),
    ))
    assert b["subtotals"]["goals"] == "35.5"
    assert isinstance(b["daily_score"], str)
    assert Decimal(json.loads(json.dumps(b))["daily_score"]) == Decimal("40.5")


def test_timezone_and_date_are_recorded():
    """A snapshot with no timezone is silently reinterpreted on another device."""
    b = build_breakdown(summary())
    assert b["timezone"] == "America/Chicago"
    assert b["date"] == "2026-08-19"
    assert b["schema"] == 2


# --- Deferred lines --------------------------------------------------------

def test_an_ordinary_line_carries_no_effective_due_date():
    """The key is noise on every line that was scored against its own due date."""
    b = build_breakdown(summary(todos=[todo("Taxes", 10, -10, due="2026-08-18")]))
    assert "effective_due_date" not in b["todos"][0]


def test_a_deferred_line_records_the_date_it_was_scored_against():
    """Otherwise a frozen day shows a dock against a due date that had not arrived,
    and there is no way to tell a locked penalty from a scoring bug."""
    b = build_breakdown(summary(todos=[
        todo("Change tires", 10, -10, due="2026-09-05", effective="2026-08-24"),
    ]))
    line = b["todos"][0]
    assert line["due_date"] == "2026-09-05"
    assert line["effective_due_date"] == "2026-08-24"
    assert line["score"] == "-10"


def test_a_cleared_due_date_records_a_null_against_its_floor():
    b = build_breakdown(summary(todos=[
        todo("Change tires", 10, -10, due=None, effective="2026-08-24"),
    ]))
    assert b["todos"][0]["due_date"] is None
    assert b["todos"][0]["effective_due_date"] == "2026-08-24"
