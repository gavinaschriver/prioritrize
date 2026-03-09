import { useState, useEffect, useRef } from 'react';
import { useScratchPad, useUpdateScratchPad } from '../../hooks/useScratchPad';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

export function ScratchPad() {
  const { data, isLoading } = useScratchPad();
  const updatePad = useUpdateScratchPad();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when data loads
  useEffect(() => {
    if (data && !editing) {
      setDraft(data.content);
    }
  }, [data, editing]);

  const handleEdit = () => {
    setDraft(data?.content ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    await updatePad.mutateAsync(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(data?.content ?? '');
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
  };

  // Auto-grow textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      textareaRef.current.focus();
    }
  }, [editing, draft]);

  const isEmpty = !data?.content?.trim();

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Scratch Pad</span>
        {!editing && (
          <button
            onClick={handleEdit}
            className="text-xs text-gray-400 hover:text-blue-600"
          >
            {isEmpty ? '+ write' : 'edit'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {editing ? (
          <div className="p-4 space-y-3">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={"# Ideas\n\n[ ] thing to try\n[ ] another idea\n\n**bold**, *italic*, ~~strikethrough~~"}
              className="w-full text-sm font-mono border-0 outline-none resize-none text-gray-700 placeholder-gray-300 min-h-[120px]"
              rows={6}
            />
            <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
              <button
                onClick={handleSave}
                disabled={updatePad.isPending}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <span className="text-xs text-gray-300 ml-auto">⌘↵ to save · Esc to cancel</span>
            </div>
          </div>
        ) : isLoading ? (
          <p className="px-4 py-3 text-sm text-gray-400">Loading...</p>
        ) : isEmpty ? (
          <button
            onClick={handleEdit}
            className="w-full px-4 py-6 text-sm text-gray-300 text-left hover:bg-gray-50 rounded-lg transition"
          >
            Click to start writing — ideas, notes, anything...
          </button>
        ) : (
          <div
            onClick={handleEdit}
            className="px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-lg transition"
          >
            <MarkdownRenderer text={data!.content} className="space-y-1" />
          </div>
        )}
      </div>

      {!editing && data?.updated_at && !isEmpty && (
        <p className="text-xs text-gray-300 mt-1 text-right">
          saved {new Date(data.updated_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}
    </div>
  );
}
