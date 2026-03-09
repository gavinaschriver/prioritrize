CREATE TABLE scratch_pad (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE scratch_pad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scratch pad" ON scratch_pad
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
