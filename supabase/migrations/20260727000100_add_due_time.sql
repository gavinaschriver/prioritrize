-- Optional per-item time of day for calendar reminders. NULL means "use the
-- connection's default_hour", so most items land at 9am while "pick up meds"
-- can land at 12:30.
--
-- Projects are milestone-grained and always use the default hour, so they get
-- no column.
ALTER TABLE todo         ADD COLUMN IF NOT EXISTS due_time TIME NULL;
ALTER TABLE project_task ADD COLUMN IF NOT EXISTS due_time TIME NULL;
