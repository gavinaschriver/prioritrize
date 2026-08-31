import { useState } from 'react';
import { TagCommentInput, CommentDisplay } from './TagCommentInput';

interface EditableCommentProps {
  value: string | null;
  onSave: (comment: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  editTitle?: string;
}

/** Click-to-edit comment, shared by daily entries, todos and project tasks. */
export function EditableComment({
  value,
  onSave,
  placeholder = 'Add a comment or #tag,',
  emptyLabel,
  editTitle,
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
        className="mt-0.5 bg-gray-50"
      />
    );
  }

  return (
    <CommentDisplay
      value={value}
      emptyLabel={emptyLabel}
      editTitle={editTitle}
      onClick={() => {
        setDraft(value ?? '');
        setIsEditing(true);
      }}
    />
  );
}
