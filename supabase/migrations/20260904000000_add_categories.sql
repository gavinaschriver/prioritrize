-- Categories are evergreen "parent epics" that work items hang under: the project
-- is "Install L-track", its category is "Vehicle Work". Todos get one too -- they
-- behave like free-radical micro projects, so "Carpentry" is just as useful on a
-- one-off todo as on a full project.
--
-- Categories outlive the things filed under them, so they're their own table
-- rather than a column, and they're shared across projects and todos rather than
-- duplicated per entity type.
CREATE TABLE IF NOT EXISTS category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE category ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own categories" ON category;
CREATE POLICY "Users manage own categories" ON category
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Case-insensitive: "Carpentry" and "carpentry" are the same evergreen bucket.
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_user_name
    ON category(user_id, lower(name));

-- SET NULL, not CASCADE: dropping a category retires the grouping, it must never
-- take the projects or todos filed under it with it.
ALTER TABLE project ADD COLUMN IF NOT EXISTS category_id UUID NULL
    REFERENCES category(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_category_id ON project(user_id, category_id);

ALTER TABLE todo ADD COLUMN IF NOT EXISTS category_id UUID NULL
    REFERENCES category(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_todo_category_id ON todo(user_id, category_id);
