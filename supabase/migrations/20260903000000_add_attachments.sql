-- Files people attach to their work: photos of a receipt, a scanned letter, a PDF.
-- Bytes live in Supabase Storage; this table is the index over them.
--
-- entity_id is polymorphic (todo, project, project_task, project_update,
-- daily_notes), so it carries no foreign key. Every read is scoped by
-- (user_id, entity_type, entity_id), so a row whose parent is gone is invisible
-- rather than wrong.
CREATE TABLE attachment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (
        entity_type IN ('todo', 'project', 'project_task', 'project_update', 'daily_note')
    ),
    entity_id UUID NOT NULL,
    -- Path inside the bucket. Always '<user_id>/...', which is what the storage
    -- policies below key on.
    storage_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    mime_type TEXT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE attachment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attachments" ON attachment
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_attachment_entity ON attachment(user_id, entity_type, entity_id);

-- Private bucket: nothing is readable without a signed URL. 25 MB a file.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', false, 26214400)
ON CONFLICT (id) DO NOTHING;

-- The browser uploads straight here, so the bucket enforces ownership itself:
-- the first path segment must be the caller's own user id.
CREATE POLICY "Users read own attachment files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
CREATE POLICY "Users upload own attachment files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
CREATE POLICY "Users delete own attachment files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
