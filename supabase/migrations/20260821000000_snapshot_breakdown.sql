-- A snapshot used to be a bare number, which made it impossible to tell a data
-- change from a scoring change after the fact. Scoring reads prioritry.is_active,
-- point_value, todo.due_date and completed_at live, none of which are versioned,
-- so recomputing an old day could silently produce a different answer than the
-- one that was frozen. These columns record what the score was made of.
--
-- breakdown: the per-line detail behind score (goals with quantity, unlogged
--   goals and their penalties, bonuses, todos, deadlines, rolling projects).
--   NULL marks the rows written before this migration -- those days cannot be
--   reconstructed and must not be rewritten.
-- timezone: the tz the day was bucketed under. Previously unrecorded, so a
--   snapshot written from one device was silently reused under another.
-- version: scoring-semantics version. 1 is everything written before the
--   overdue-penalty fix; 2 is written by the current formula.
-- finalized: true once the day has closed. upsert_snapshot refuses to overwrite
--   a finalized row without an explicit force, which is what makes the backfill
--   idempotent.
ALTER TABLE daily_snapshot
    ADD COLUMN breakdown JSONB NULL,
    ADD COLUMN timezone  TEXT NULL,
    ADD COLUMN version   INT NOT NULL DEFAULT 1,
    ADD COLUMN finalized BOOLEAN NOT NULL DEFAULT true;
