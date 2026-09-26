-- Let a day's plan hide things it would otherwise show.
--
-- Dailies (and anything due that day) appear in the bank by derivation, with no
-- row to delete, so hiding one for a single day needs a row that says so. A
-- 'dismissed' placement is that row: it claims the item for the day the same way
-- a slot does, which keeps it out of the derived bank, and deleting it brings the
-- item back. Like the bank, it has no slot.
ALTER TABLE day_plan_item DROP CONSTRAINT IF EXISTS day_plan_item_section_check;
ALTER TABLE day_plan_item ADD CONSTRAINT day_plan_item_section_check
    CHECK (section IN ('bank', 'dismissed', 'morning', 'afternoon', 'evening'));

ALTER TABLE day_plan_item DROP CONSTRAINT IF EXISTS day_plan_item_slot_shape;
ALTER TABLE day_plan_item ADD CONSTRAINT day_plan_item_slot_shape CHECK (
    (section IN ('bank', 'dismissed')) = (slot_index IS NULL)
);

-- Freeform blocks still only live on the timeline.
ALTER TABLE day_plan_item DROP CONSTRAINT IF EXISTS day_plan_item_entity_shape;
ALTER TABLE day_plan_item ADD CONSTRAINT day_plan_item_entity_shape CHECK (
    (entity_type = 'freeform' AND entity_id IS NULL
        AND section IN ('morning', 'afternoon', 'evening'))
    OR (entity_type <> 'freeform' AND entity_id IS NOT NULL AND freeform_text IS NULL)
);
