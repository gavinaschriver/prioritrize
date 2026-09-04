-- "I'm done logging this day" was a localStorage flag, so every device asked
-- again. daily_snapshot is already the one row per (user, date), which makes it
-- the natural home: one source of truth, synced everywhere.
--
-- Deliberately separate from `finalized`. finalized means the scorer has closed
-- the day and its number is immutable; wrapped_up_at means the human is done
-- entering things. A day is finalized automatically at midnight whether or not
-- anyone ever looked at it.
ALTER TABLE daily_snapshot ADD COLUMN IF NOT EXISTS wrapped_up_at TIMESTAMPTZ NULL;
