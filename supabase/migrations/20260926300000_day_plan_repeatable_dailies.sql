-- A repeatable daily (music-making, a timeblock) can be planned more than once
-- in a day: a morning session, then band practice in the evening. So dailies
-- are exempt from "one placement per item per day"; the API still holds
-- non-repeatable dailies to one, since only it knows can_repeat.
DROP INDEX IF EXISTS day_plan_item_once_per_day;
CREATE UNIQUE INDEX IF NOT EXISTS day_plan_item_once_per_day
    ON day_plan_item (user_id, plan_date, entity_type, entity_id)
    WHERE entity_id IS NOT NULL AND entity_type <> 'prioritry';
