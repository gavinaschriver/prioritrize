-- The Day view: arranging a day's work into Morning / Afternoon / Evening slots.
--
-- Only deliberate placements are stored. Items due on a date show up in that
-- day's bank by derivation, with no row here; a row exists only once you put
-- something in a slot, or pull a not-yet-due item into the bank via "+ Other".
-- Sending a block back to the bank deletes its row, and if it was due that day
-- it simply reappears in the derived bank.
--
-- Slots are positional: one block per (day, section, slot_index), and an empty
-- slot is just a missing row. That's what lets an evening item sit in slot 2
-- with visible space above it.
--
-- entity_id carries no FK because it points at todo, project_task or prioritry;
-- the API ignores placements whose item no longer exists.
CREATE TABLE IF NOT EXISTS day_plan_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    section TEXT NOT NULL CHECK (section IN ('bank', 'morning', 'afternoon', 'evening')),
    slot_index INT CHECK (slot_index >= 0),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('todo', 'project_task', 'prioritry', 'freeform')),
    entity_id UUID,
    freeform_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- The bank is an unordered pile; the timeline is positional.
    CONSTRAINT day_plan_item_slot_shape CHECK (
        (section = 'bank') = (slot_index IS NULL)
    ),
    -- Freeform blocks are text with no item behind them, and only live on the
    -- timeline -- there's nothing "due" about them to sit in a bank.
    CONSTRAINT day_plan_item_entity_shape CHECK (
        (entity_type = 'freeform' AND entity_id IS NULL AND section <> 'bank')
        OR (entity_type <> 'freeform' AND entity_id IS NOT NULL AND freeform_text IS NULL)
    ),
    -- One block per slot. DEFERRABLE so a swap can move two blocks through each
    -- other's slots inside one transaction and only be checked at commit.
    -- (Bank rows have NULL slot_index, and NULLs never collide, so any number fit.)
    CONSTRAINT day_plan_item_one_per_slot UNIQUE (user_id, plan_date, section, slot_index)
        DEFERRABLE INITIALLY IMMEDIATE
);

-- The same item can't be in two places on the same day.
CREATE UNIQUE INDEX IF NOT EXISTS day_plan_item_once_per_day
    ON day_plan_item (user_id, plan_date, entity_type, entity_id)
    WHERE entity_id IS NOT NULL;

ALTER TABLE day_plan_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own day plan" ON day_plan_item;
CREATE POLICY "Users manage own day plan" ON day_plan_item
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
