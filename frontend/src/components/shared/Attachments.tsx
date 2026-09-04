import { useRef, useState } from 'react';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  attachmentUrl,
  MAX_ATTACHMENT_BYTES,
} from '../../hooks/useAttachments';
import type { Attachment, AttachmentEntityType } from '../../types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface AttachmentsProps {
  type: AttachmentEntityType;
  /** Null while the parent record is still being created. */
  id: string | null;
  /** Pre-fetched by a parent that batched the whole page; skips the own query. */
  items?: Attachment[];
  className?: string;
}

/**
 * Files hanging off one record. A plain file input is the whole affordance:
 * on a phone it offers the camera and photo library, on a desktop the file
 * picker, without this component knowing which it's talking to.
 */
export function Attachments({ type, id, items, className = '' }: AttachmentsProps) {
  const { data: attachments } = useAttachments(type, items ? null : id);
  const upload = useUploadAttachment(type, id ?? '');
  const remove = useDeleteAttachment(type);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (!id) return null;
  const files = items ?? attachments ?? [];

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    // One at a time, so a rejected file names itself instead of failing a batch.
    for (const file of Array.from(list)) {
      try {
        await upload.mutateAsync(file);
      } catch (e) {
        setError((e as Error).message);
        break;
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const open = async (attachment: Attachment) => {
    setError(null);
    try {
      // Popup blockers only trust a window opened during the click, so claim it
      // now and point it at the signed URL once that comes back.
      const tab = window.open('', '_blank');
      const url = await attachmentUrl(attachment.storage_path);
      // No tab means the browser blocked it; assign into the current one instead.
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className={`text-xs ${className}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="text-gray-500 hover:text-blue-600 disabled:opacity-50"
          title={`Attach a file (up to ${formatSize(MAX_ATTACHMENT_BYTES)})`}
        >
          {upload.isPending ? 'uploading…' : '📎 attach'}
        </button>
        {files.map(a => (
          <span key={a.id} className="inline-flex items-center gap-1 max-w-full">
            <button
              type="button"
              onClick={() => open(a)}
              className="text-blue-600 hover:underline truncate max-w-[14rem]"
              title={`${a.file_name} — ${formatSize(a.size_bytes)}`}
            >
              {a.file_name}
            </button>
            <span className="text-gray-500">{formatSize(a.size_bytes)}</span>
            <button
              type="button"
              onClick={() => remove.mutate(a)}
              disabled={remove.isPending}
              className="text-red-400 hover:text-red-600 disabled:opacity-40"
              title="Remove attachment"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {error && <p className="mt-0.5 text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
}
