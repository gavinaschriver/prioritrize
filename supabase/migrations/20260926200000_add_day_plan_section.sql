-- How many slots each Day view section shows, per day.
--
-- Every section starts with 3. A row only exists once a day's count moves off
-- that default -- an empty slot removed, or a block dropped past the last one --
-- so untouched days cost nothing. The API never reports fewer slots than the
-- highest occupied slot_index + 1, so a stale count can't hide a block.
CREATE TABLE IF NOT EXISTS day_plan_section (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    section TEXT NOT NULL CHECK (section IN ('morning', 'afternoon', 'evening')),
    slot_count INT NOT NULL CHECK (slot_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, plan_date, section)
);

ALTER TABLE day_plan_section ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own day plan sections" ON day_plan_section;
CREATE POLICY "Users manage own day plan sections" ON day_plan_section
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
