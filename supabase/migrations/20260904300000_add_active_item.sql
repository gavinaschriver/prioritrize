-- The "bullpen": the one thing you are working on right now.
--
-- Stored as a single pointer per user rather than an in_progress boolean on both
-- todo and project_task. The rule is that exactly one item is active at a time,
-- and a PRIMARY KEY on user_id makes that true by construction -- two rows can
-- never both claim it, and switching is one upsert rather than a clear-then-set
-- across two tables that could half-fail.
--
-- entity_id carries no FK because it points at either table; the API clears the
-- row when the item it names is completed, deleted or converted.
CREATE TABLE IF NOT EXISTS active_item (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('todo', 'project_task')),
    entity_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE active_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own active item" ON active_item;
CREATE POLICY "Users manage own active item" ON active_item
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
