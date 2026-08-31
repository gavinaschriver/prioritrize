-- Todos and tasks get two text fields instead of one: `description` is what to
-- accomplish and how, `comment` records how the doing of it actually went.
--
-- What people wrote in the old single `comment` field was descriptive, so it is
-- renamed to `description` (keeping the text, and any #tags in it) and a fresh,
-- empty `comment` is added alongside.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'todo' AND column_name = 'comment')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'todo' AND column_name = 'description') THEN
        ALTER TABLE todo RENAME COLUMN comment TO description;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'project_task' AND column_name = 'comment')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'project_task' AND column_name = 'description') THEN
        ALTER TABLE project_task RENAME COLUMN comment TO description;
    END IF;
END $$;

ALTER TABLE todo ADD COLUMN IF NOT EXISTS comment TEXT NULL;
ALTER TABLE project_task ADD COLUMN IF NOT EXISTS comment TEXT NULL;
