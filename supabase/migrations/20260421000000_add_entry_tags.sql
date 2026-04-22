-- entry_tag: one row per tag per entry, synced by the application layer
CREATE TABLE entry_tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entry_tag_user_tag     ON entry_tag(user_id, tag);
CREATE INDEX idx_entry_tag_user_created ON entry_tag(user_id, created_at);
CREATE INDEX idx_entry_tag_entry        ON entry_tag(entry_id);

ALTER TABLE entry_tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entry tags"
    ON entry_tag FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entry tags"
    ON entry_tag FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own entry tags"
    ON entry_tag FOR DELETE USING (auth.uid() = user_id);

-- Backfill: extract leading #tag segments from existing comment values.
-- Comment format: "#tag one, #tag two, optional plain text"
-- Each comma-space-separated part that starts with '#' is a tag.
INSERT INTO entry_tag (entry_id, user_id, tag, created_at)
SELECT e.id,
       e.user_id,
       trim(substr(p.part, 2)) AS tag,   -- strip leading '#' and any surrounding whitespace
       e.created_at
FROM entry e
CROSS JOIN LATERAL unnest(string_to_array(e.comment, ', ')) AS p(part)
WHERE e.comment IS NOT NULL
  AND p.part LIKE '#%'
  AND length(trim(substr(p.part, 2))) > 0;
