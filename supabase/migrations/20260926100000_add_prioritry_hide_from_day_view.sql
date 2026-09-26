-- Some dailies are standing rules, not things you do at a time: "no screens
-- after 9", "phone locked away by 9:30". They still score on the tracker, but
-- there's nothing to schedule, so the Day view leaves them out of its drawer.
ALTER TABLE prioritry ADD COLUMN IF NOT EXISTS hide_from_day_view BOOLEAN NOT NULL DEFAULT false;
