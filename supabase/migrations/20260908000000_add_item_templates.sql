-- Blueprints for work that gets re-entered, and optionally the interval that
-- re-enters it for you.
--
-- Templates and recurrences share one table because they are one idea: a
-- recurring todo IS a template that instantiates itself. `repeat_every_days IS
-- NULL` means the template sits and waits to be picked out of the tracker's
-- dropdown; a value means it materializes on its own. The binary choice on the
-- form is literally this column being null or not.
--
-- Its own table rather than an `is_template` flag on `todo`, even though the flag
-- is the smaller migration. compute_day_score, get_balance, list_todos,
-- ref_service.resolve, the dashboard and the read-only MCP server all SELECT from
-- `todo` directly. A blueprint that leaked into any one of them would silently
-- dock points or consume a #NNNN, and every one of them would have to carry an
-- `AND NOT is_template` correctly, forever, including the ones not written yet.
-- Nothing in this table is visible to any of them.
CREATE TABLE item_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- What gets built when this fires. A 'task' carries the project it belongs
    -- to; a 'todo' is free-standing and must not.
    kind TEXT NOT NULL DEFAULT 'todo' CHECK (kind IN ('todo', 'task')),
    project_id UUID NULL REFERENCES project(id) ON DELETE CASCADE,

    -- The blueprint proper: exactly the fields TodoCreate and ProjectTaskCreate
    -- take, and nothing else.
    --
    -- No due_date, because a template has no date -- the date is what you supply
    -- at the moment you instantiate it, or what the interval computes.
    -- No ref_number, because a #NNNN names one real thing you can point at in
    -- prose, and a blueprint is not one. Numbers are handed out by
    -- ref_service.next_ref_number when an instance is actually created.
    name TEXT NOT NULL,
    point_value INT NOT NULL DEFAULT 1 CHECK (point_value >= 0),
    description TEXT NULL,
    -- SET NULL like every other category reference: retiring a grouping must not
    -- take the templates filed under it.
    category_id UUID NULL REFERENCES category(id) ON DELETE SET NULL,

    -- The whole schedule: "repeat every N days", counted from starts_on.
    -- NULL = a manual template with no schedule at all.
    --
    -- One interval and an anchor date, rather than weekday sets and days-of-month.
    -- "Every Friday" is every 7 days anchored on a Friday -- same dates, and the
    -- date picker already answers "which Friday" without this table needing a
    -- concept of weekdays. What it deliberately cannot express is calendar-month
    -- recurrence ("the 1st of every month"), because months are 28-31 days and no
    -- day interval lands on the 1st twice running. Nothing needs that yet; when
    -- something does, it is another nullable column, not a redesign.
    repeat_every_days INT NULL CHECK (repeat_every_days >= 1),

    -- The anchor, and the first occurrence. Never null for a recurring template:
    -- create_template stamps the user's local today when the caller leaves it
    -- blank, so the interval counts from a date they would recognise rather than
    -- from a UTC created_at that can sit on the wrong side of midnight.
    starts_on DATE NULL,
    -- Retires the series without deleting it, so the instances it already
    -- produced keep their provenance.
    ends_on DATE NULL,
    -- Stops generation while keeping the schedule intact, which is what you want
    -- for a chore you're skipping for a month, not abandoning.
    paused BOOLEAN NOT NULL DEFAULT false,

    -- The last occurrence date this template produced OR was deliberately skipped
    -- past. Both cases advance it, and that is the whole catch-up policy: coming
    -- back after a week away owes you one trash-taking, not seven. Missed
    -- occurrences are not a debt, and materializing them as a stack of
    -- already-overdue todos would dock the day you returned for every one.
    last_materialized_on DATE NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A task template needs somewhere to put the task; a todo template must not
    -- claim to.
    CONSTRAINT item_template_project_matches_kind CHECK (
        (kind = 'task' AND project_id IS NOT NULL) OR
        (kind = 'todo' AND project_id IS NULL)),

    -- Recurrence is todos-only for now. A self-refilling task raises questions a
    -- todo doesn't -- what a project that keeps growing tasks means for reading
    -- as "finishable", and what happens to the series when the project completes.
    -- Dropping this constraint is the whole schema change needed to answer them
    -- later; see docs/templates-and-recurrence.md.
    CONSTRAINT item_template_recurrence_is_todo_only CHECK (
        repeat_every_days IS NULL OR kind = 'todo'),

    -- An interval with nothing to count from would generate nothing, forever, and
    -- silently. The service stamps starts_on rather than relying on this, but the
    -- table is the thing that has to be right.
    CONSTRAINT item_template_schedule_has_an_anchor CHECK (
        repeat_every_days IS NULL OR starts_on IS NOT NULL),

    CONSTRAINT item_template_ends_after_it_starts CHECK (
        ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

ALTER TABLE item_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own item templates" ON item_template;
CREATE POLICY "Users manage own item templates" ON item_template
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_item_template_user ON item_template(user_id);
-- The materializer runs on every day-summary load and asks exactly one question:
-- which of this user's schedules are live? Partial, because manual templates and
-- paused ones are the majority and never belong in the answer.
CREATE INDEX idx_item_template_active_schedules ON item_template(user_id)
    WHERE repeat_every_days IS NOT NULL AND paused = false;

-- Which series produced this todo, if any.
--
-- Nothing in scoring selects this column -- it exists so the generator can answer
-- "is a previous occurrence of this series still open?" and decline to stack a
-- second identical chore on top of one you haven't done yet.
--
-- SET NULL, not CASCADE: deleting a template retires the blueprint, it must never
-- take the real, possibly-completed work it produced with it.
ALTER TABLE todo ADD COLUMN IF NOT EXISTS template_id UUID NULL
    REFERENCES item_template(id) ON DELETE SET NULL;

-- Partial, matching the only query that reads it: the open instances of a series.
CREATE INDEX IF NOT EXISTS idx_todo_open_by_template ON todo(template_id)
    WHERE completed_at IS NULL;
