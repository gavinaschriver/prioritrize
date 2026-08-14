-- How many timeblocks one entry represents. A 3-hour deep clean is now one row
-- with quantity 3 rather than three duplicate rows sharing the same tags.
--
-- DEFAULT 1 keeps every existing entry scoring exactly as it did, so no
-- daily_snapshot recompute is needed.
ALTER TABLE entry ADD COLUMN quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0);
