-- spend: one row per logged expense. Purely informational — never scored.
CREATE TABLE spend (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spend_user_created ON spend(user_id, created_at);

ALTER TABLE spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own spend" ON spend
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- spend_tag: one row per tag per spend, synced by the application layer.
CREATE TABLE spend_tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spend_id UUID NOT NULL REFERENCES spend(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spend_tag_user_tag     ON spend_tag(user_id, tag);
CREATE INDEX idx_spend_tag_user_created ON spend_tag(user_id, created_at);
CREATE INDEX idx_spend_tag_spend        ON spend_tag(spend_id);

ALTER TABLE spend_tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own spend tags" ON spend_tag
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
