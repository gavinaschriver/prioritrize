import { useState } from 'react';
import { useDeleteEntry, useUpdateEntryComment } from '../../hooks/useEntries';
import type { DaySummary } from '../../types';

interface EntryListProps {
  summary: DaySummary;
}

function EditableComment({
  entryId,
  initialComment,
}: {
  entryId: string;
  initialComment: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialComment ?? '');
  const updateComment = useUpdateEntryComment();

  const save = () => {
    const trimmed = value.trim();
    const newComment = trimmed === '' ? null : trimmed;
    if (newComment !== initialComment) {
      updateComment.mutate({ entryId, comment: newComment });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      setValue(initialComment ?? '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder="Add a comment..."
        className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    );
  }

  return (
    <p
      onClick={() => {
        setValue(initialComment ?? '');
        setIsEditing(true);
      }}
      className="text-xs text-gray-500 italic mt-0.5 cursor-pointer hover:text-gray-700 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
      title="Click to edit comment"
    >
      {initialComment || 'Add comment...'}
    </p>
  );
}

export function EntryList({ summary }: EntryListProps) {
  const deleteEntry = useDeleteEntry();

  // Collect all entries from goals and bonuses with their prioritry name
  const allEntries = [
    ...summary.goals.flatMap(g =>
      g.entries.map(e => ({ ...e, prioritryName: g.name, timeblock: g.timeblock, commentsEnabled: g.comments_enabled }))
    ),
    ...summary.bonuses.flatMap(b =>
      b.entries.map(e => ({ ...e, prioritryName: b.name, timeblock: b.timeblock, commentsEnabled: b.comments_enabled }))
    ),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allEntries.length === 0) return null;

  const formatName = (name: string, timeblock: number | null) => {
    if (timeblock) {
      const hours = Math.floor(timeblock / 60);
      const mins = timeblock % 60;
      const timeStr = hours > 0
        ? (mins > 0 ? `${hours} hr ${mins} min` : `${hours} hour`)
        : `${mins} min`;
      return `${name} ${timeStr}`;
    }
    return name;
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Today's Entries
      </h3>
      <div className="space-y-2">
        {allEntries.map(entry => (
          <div key={entry.id} className="flex items-start justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{formatName(entry.prioritryName, entry.timeblock)}</p>
              {entry.commentsEnabled ? (
                <EditableComment entryId={entry.id} initialComment={entry.comment} />
              ) : entry.comment ? (
                <p className="text-xs text-gray-500 italic mt-0.5">{entry.comment}</p>
              ) : null}
            </div>
            <button
              onClick={() => deleteEntry.mutate(entry.id)}
              disabled={deleteEntry.isPending}
              className="shrink-0 ml-2 text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
