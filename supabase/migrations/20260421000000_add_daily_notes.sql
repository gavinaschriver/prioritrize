CREATE TABLE daily_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily notes" ON daily_notes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
