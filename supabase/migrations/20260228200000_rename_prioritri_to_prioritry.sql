-- Rename table prioritri -> prioritry
ALTER TABLE prioritri RENAME TO prioritry;

-- Rename column in entry table
ALTER TABLE entry RENAME COLUMN prioritri_id TO prioritry_id;

-- Rename indexes (Postgres auto-renames the PK constraint but not other indexes)
ALTER INDEX IF EXISTS idx_prioritri_user_active RENAME TO idx_prioritry_user_active;
ALTER INDEX IF EXISTS idx_entry_prioritri RENAME TO idx_entry_prioritry;
