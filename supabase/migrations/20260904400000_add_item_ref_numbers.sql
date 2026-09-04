-- Jira-style reference numbers for todos and project tasks, so one can point at
-- another in prose: "blocked by #1042".
--
-- One sequence shared by both tables, per user. Shared because a reference has
-- to resolve without knowing which kind of thing it names; per user because the
-- numbers are meant to be short and memorable, and a global sequence would leave
-- gaps wherever someone else created something.
--
-- Allocation goes through ref_counter rather than MAX(ref_number)+1: UPDATE takes
-- a row lock, so two creates in flight can't hand out the same number.
CREATE TABLE IF NOT EXISTS ref_counter (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Starts at 999 so the first allocation returns 1000 and every number is
    -- four digits, which is what the #NNNN syntax expects.
    last_number INT NOT NULL DEFAULT 999
);

ALTER TABLE ref_counter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own ref counter" ON ref_counter;
CREATE POLICY "Users manage own ref counter" ON ref_counter
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE todo         ADD COLUMN IF NOT EXISTS ref_number INT;
ALTER TABLE project_task ADD COLUMN IF NOT EXISTS ref_number INT;

-- Backfill in creation order, interleaving both tables, so the oldest work gets
-- the lowest number and the numbering reads like a history.
--
-- Both UPDATEs live in one statement as data-modifying CTEs so they share a
-- single snapshot of `numbered`. Run as two statements, the first would set the
-- todos and the second would then see them as already-numbered and start the
-- tasks after them, breaking the interleave.
WITH ordered AS (
    SELECT 'todo' AS kind, id, user_id, created_at FROM todo WHERE ref_number IS NULL
    UNION ALL
    SELECT 'task', id, user_id, created_at FROM project_task WHERE ref_number IS NULL
),
numbered AS (
    SELECT kind, id,
           999 + row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS n
    FROM ordered
),
upd_todo AS (
    UPDATE todo t SET ref_number = n.n
    FROM numbered n WHERE n.kind = 'todo' AND n.id = t.id
    RETURNING 1
)
UPDATE project_task pt SET ref_number = n.n
FROM numbered n WHERE n.kind = 'task' AND n.id = pt.id;

-- Seed the counter past everything the backfill handed out.
INSERT INTO ref_counter (user_id, last_number)
SELECT user_id, MAX(m) FROM (
    SELECT user_id, MAX(ref_number) AS m FROM todo         GROUP BY user_id
    UNION ALL
    SELECT user_id, MAX(ref_number)      FROM project_task GROUP BY user_id
) s
WHERE m IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
    SET last_number = GREATEST(ref_counter.last_number, EXCLUDED.last_number);

-- A number names one thing. Cross-table uniqueness is held by the shared counter.
CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_ref_number         ON todo(user_id, ref_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_task_ref_number ON project_task(user_id, ref_number);
