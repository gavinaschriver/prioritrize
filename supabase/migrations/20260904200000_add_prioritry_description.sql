-- A daily is a template you repeat, so it earns a standing description: what
-- counts as done, links, a checklist of what the routine involves. Distinct from
-- an entry's comment, which records how one particular logging of it went.
ALTER TABLE prioritry ADD COLUMN IF NOT EXISTS description TEXT NULL;
