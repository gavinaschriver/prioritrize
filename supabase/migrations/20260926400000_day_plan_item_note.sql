-- What a scheduled session is going to be, specifically: "Exercise" slotted in
-- the morning, noted "long walk". It belongs to the placement, not the daily --
-- Tuesday's exercise can be climbing -- and seeds the log comment when the
-- session is logged from the Day view.
ALTER TABLE day_plan_item ADD COLUMN IF NOT EXISTS note TEXT;
