-- One row per procrastination event: a due date pushed later, or cleared, while
-- the item was already due or overdue.
--
-- Scoring reads due_date live, so moving it forward used to refund every past day
-- the item had been docking. These rows are the missing history: they let
-- compute_day_score reconstruct the due date an item was judged against on any
-- given day, which keeps the penalty and keeps closed days recomputable.
CREATE TABLE due_date_deferral (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- No FK: item_id points at todo, project or project_task depending on
    -- item_type. Rows orphaned by a delete are harmless -- a deleted item has
    -- nothing left to score.
    item_type TEXT NOT NULL CHECK (item_type IN ('todo', 'project', 'task')),
    item_id UUID NOT NULL,
    previous_due_date DATE NOT NULL,
    new_due_date DATE NULL,  -- NULL = cleared, an open-ended deferral
    deferred_on DATE NOT NULL,  -- the user's LOCAL day the change was made
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE due_date_deferral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own due date deferrals" ON due_date_deferral
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Scoring asks "every deferral for this user on or after day D", once per day scored.
CREATE INDEX idx_due_date_deferral_user_deferred_on ON due_date_deferral(user_id, deferred_on);
