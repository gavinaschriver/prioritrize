-- Type table (seeded with exactly 2 rows)
CREATE TABLE type (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (name IN ('Goal', 'Bonus'))
);

INSERT INTO type (name) VALUES ('Goal'), ('Bonus');

-- Prioritri table (habit/task definitions)
CREATE TABLE prioritri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type_id INT NOT NULL REFERENCES type(id),
    point_value INT NOT NULL CHECK (point_value > 0),
    can_repeat BOOLEAN NOT NULL DEFAULT true,
    timeblock INT,
    comments_enabled BOOLEAN NOT NULL DEFAULT false,
    extra_penalty INT NOT NULL DEFAULT 0 CHECK (extra_penalty >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entry table (each [+] tap)
CREATE TABLE entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prioritri_id UUID NOT NULL REFERENCES prioritri(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily snapshot (cached daily score for cumulative balance)
CREATE TABLE daily_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    score DECIMAL NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_prioritri_user_active ON prioritri(user_id, is_active);
CREATE INDEX idx_entry_user_created ON entry(user_id, created_at);
CREATE INDEX idx_entry_prioritri ON entry(prioritri_id, created_at);
CREATE INDEX idx_snapshot_user ON daily_snapshot(user_id, date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prioritri_updated_at
    BEFORE UPDATE ON prioritri
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE prioritri ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prioritris"
    ON prioritri FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prioritris"
    ON prioritri FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prioritris"
    ON prioritri FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own entries"
    ON entry FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entries"
    ON entry FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own entries"
    ON entry FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own snapshots"
    ON daily_snapshot FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own snapshots"
    ON daily_snapshot FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read types"
    ON type FOR SELECT TO authenticated USING (true);
