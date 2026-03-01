-- Simplify scoring: remove extra_penalty column
-- New model: missed Goal = -point_value (no more 1/2 + extra_penalty)
ALTER TABLE prioritry DROP COLUMN extra_penalty;
