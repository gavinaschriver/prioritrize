-- Comments on todos and project tasks, editable from the dashboard like daily entry comments
ALTER TABLE todo ADD COLUMN IF NOT EXISTS comment TEXT NULL;
ALTER TABLE project_task ADD COLUMN IF NOT EXISTS comment TEXT NULL;
