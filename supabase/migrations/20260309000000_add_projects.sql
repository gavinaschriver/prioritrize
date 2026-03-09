CREATE TABLE project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    point_value INT NOT NULL DEFAULT 40 CHECK (point_value >= 40),
    due_date DATE NOT NULL,
    overview TEXT NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON project
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_project_user_id ON project(user_id);
CREATE INDEX idx_project_due_date ON project(due_date);

CREATE TABLE project_update (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE project_update ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project updates" ON project_update
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_project_update_project_id ON project_update(project_id);
