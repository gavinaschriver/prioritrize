-- Categories are evergreen "parent epics" a project hangs under: a project is
-- "Install L-track", its category is "Vehicle Work". Categories outlive the
-- projects in them, so they're their own table rather than a column on project.
CREATE TABLE IF NOT EXISTS project_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE project_category ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own project categories" ON project_category;
CREATE POLICY "Users manage own project categories" ON project_category
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Case-insensitive: "Carpentry" and "carpentry" are the same evergreen bucket.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_category_user_name
    ON project_category(user_id, lower(name));

-- SET NULL, not CASCADE: dropping a category retires the grouping, it must never
-- take the projects filed under it with it.
ALTER TABLE project ADD COLUMN IF NOT EXISTS category_id UUID NULL
    REFERENCES project_category(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_category_id ON project(user_id, category_id);
