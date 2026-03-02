CREATE TABLE todo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    point_value INT NOT NULL DEFAULT 1 CHECK (point_value > 0),
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE todo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own todos" ON todo
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_todo_user_id ON todo(user_id);
CREATE INDEX idx_todo_completed_at ON todo(completed_at);
