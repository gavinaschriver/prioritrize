-- Make project due_date and point_value optional
ALTER TABLE project ALTER COLUMN due_date DROP NOT NULL;
ALTER TABLE project DROP CONSTRAINT IF EXISTS project_point_value_check;
ALTER TABLE project ALTER COLUMN point_value DROP NOT NULL;
ALTER TABLE project ADD CONSTRAINT project_point_value_check
    CHECK (point_value IS NULL OR point_value >= 0);

CREATE TABLE project_task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    point_value INT NOT NULL DEFAULT 0 CHECK (point_value >= 0),
    due_date DATE NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE project_task ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project tasks" ON project_task
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_project_task_project_id ON project_task(project_id);
CREATE INDEX idx_project_task_due_date ON project_task(due_date);
CREATE INDEX idx_project_task_user_id ON project_task(user_id);
