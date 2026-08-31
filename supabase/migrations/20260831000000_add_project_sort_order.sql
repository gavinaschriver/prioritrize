-- Manual ordering for the Projects page. Backfilled from the order the list
-- already showed (due date, then age) so nothing visibly moves on deploy.
ALTER TABLE project ADD COLUMN IF NOT EXISTS sort_order INT;

WITH ordered AS (
    SELECT id, row_number() OVER (
        PARTITION BY user_id
        ORDER BY due_date ASC NULLS LAST, created_at ASC
    ) AS rn
    FROM project
)
UPDATE project p SET sort_order = o.rn
FROM ordered o
WHERE p.id = o.id AND p.sort_order IS NULL;

ALTER TABLE project ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE project ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_sort_order ON project(user_id, sort_order);
