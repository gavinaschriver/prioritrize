import { useState } from 'react';
import { Markdown } from './Markdown';
import { RichTextEditor } from './RichTextEditor';

interface MarkdownFieldProps {
  value: string | null;
  onSave: (value: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Render only, no editing — a daily's description on the tracker. */
  readOnly?: boolean;
  rows?: number;
}

/**
 * One markdown body in a detail sheet: rendered until you click it, then a
 * textarea with the formatting toolbar. Checkboxes stay clickable in the
 * rendered state, so ticking something off never needs the editor.
 */
export function MarkdownField({
  value,
  onSave,
  placeholder,
  emptyLabel = 'Click to add...',
  readOnly = false,
  rows = 4,
}: MarkdownFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const save = () => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next !== value) onSave(next);
    setEditing(false);
  };

  if (editing && !readOnly) {
    return (
      <div className="space-y-2">
        <RichTextEditor
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
          rows={rows}
          autoFocus
          onEscape={() => { setDraft(value ?? ''); setEditing(false); }}
        />
        <div className="flex gap-2">
          <button onClick={save} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            Save
          </button>
          <button
            onClick={() => { setDraft(value ?? ''); setEditing(false); }}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const open = () => {
    if (readOnly) return;
    setDraft(value ?? '');
    setEditing(true);
  };

  if (!value?.trim()) {
    return readOnly ? (
      <p className="text-sm italic text-gray-500">Nothing written.</p>
    ) : (
      <button
        onClick={open}
        className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
      >
        {emptyLabel}
      </button>
    );
  }

  return (
    <div
      onClick={readOnly ? undefined : open}
      className={`rounded-lg border border-transparent px-1 py-0.5 ${
        readOnly ? '' : 'cursor-text hover:border-gray-200 hover:bg-gray-50'
      }`}
      title={readOnly ? undefined : 'Click to edit'}
    >
      <Markdown size="sm" className="text-gray-700" onToggleTask={readOnly ? undefined : next => onSave(next)}>
        {value}
      </Markdown>
    </div>
  );
}
