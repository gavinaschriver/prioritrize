import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Attachment, AttachmentEntityType } from '../types';

const BUCKET = 'attachments';
/** Matches the bucket's own limit, so a too-big file is caught before the upload. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const key = (type: AttachmentEntityType, id: string) => ['attachments', type, id];
// Mutations invalidate the whole type, so a per-record list and a batched
// by-type list can't drift apart.
const typeKey = (type: AttachmentEntityType) => ['attachments', type];

export function useAttachments(type: AttachmentEntityType, id: string | null) {
  return useQuery<Attachment[]>({
    queryKey: key(type, id ?? ''),
    queryFn: () => api.get(`/api/attachments?entity_type=${type}&entity_id=${id}`),
    enabled: !!id,
  });
}

/**
 * Every attachment of one type, grouped by record. A page listing many records
 * (a project's updates, say) fetches once instead of once per row.
 */
export function useAttachmentsByEntity(type: AttachmentEntityType, enabled = true) {
  const { data } = useQuery<Attachment[]>({
    queryKey: key(type, 'all'),
    queryFn: () => api.get(`/api/attachments?entity_type=${type}`),
    enabled,
  });
  const byEntity = new Map<string, Attachment[]>();
  for (const a of data ?? []) {
    const list = byEntity.get(a.entity_id);
    if (list) list.push(a);
    else byEntity.set(a.entity_id, [a]);
  }
  return byEntity;
}

/** Strip anything that would make an awkward object key, but keep the extension. */
function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(-120);
}

/**
 * Bytes go straight from the browser to Supabase Storage — the API never sees
 * them — and only the resulting path is recorded. Storage policies require the
 * first path segment to be the uploader's own id, so a file can't be written
 * into anyone else's folder.
 */
export function useUploadAttachment(type: AttachmentEntityType, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new Error(`${file.name} is larger than 25MB`);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const path = `${user.id}/${type}/${id}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (error) throw new Error(error.message);

      return api.post('/api/attachments', {
        entity_type: type,
        entity_id: id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: typeKey(type) });
    },
  });
}

export function useDeleteAttachment(type: AttachmentEntityType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: Attachment) => {
      await api.delete(`/api/attachments/${attachment.id}`);
      // The record is the thing that matters; a file left behind by a failed
      // remove is invisible, so don't fail the delete over it.
      await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: typeKey(type) });
    },
  });
}

/** The bucket is private, so opening a file means minting a short-lived URL. */
export async function attachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data) throw new Error(error?.message ?? 'Could not open file');
  return data.signedUrl;
}
