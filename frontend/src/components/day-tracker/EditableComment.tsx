import { useState } from 'react';
import { TagCommentInput, CommentDisplay } from './TagCommentInput';

interface EditableCommentProps {
  value: string | null;
  onSave: (comment: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  editTitle?: string;
  /** Edit as a markdown body in a textarea instead of a one-line comment. */
  multiline?: boolean;
}

/** Click-to-edit comment, shared by daily entries, todos and project tasks. */
export function EditableComment({
  value,
  onSave,
  placeholder = 'Add a comment or #tag,',
  emptyLabel,
  editTitle,
  multiline = false,
}: EditableCommentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const save = () => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next !== value) onSave(next);
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <TagCommentInput
        value={draft}
        onChange={setDraft}
        placeholder={placeholder}
        onSubmit={save}
        onBlur={save}
        onEscape={cancel}
        autoFocus
        multiline={multiline}
        className="mt-0.5 bg-gray-50"
      />
    );
  }

  return (
    <CommentDisplay
      value={value}
      emptyLabel={emptyLabel}
      editTitle={editTitle}
      multiline={multiline}
      // Ticking a box saves straight from the rendered view — the editor is
      // for writing, not for hunting down brackets.
      onToggleTask={multiline ? next => onSave(next) : undefined}
      onClick={() => {
        setDraft(value ?? '');
        setIsEditing(true);
      }}
    />
  );
}
