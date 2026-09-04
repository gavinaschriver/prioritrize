import { useState } from 'react';
import { useCreateEntry, useUpdateEntryComment, useDeleteEntry } from '../../hooks/useEntries';
import { Modal, ModalSection } from './Modal';
import { MarkdownField } from './MarkdownField';
import { RichTextEditor } from './RichTextEditor';
import type { DayPrioritrySummary } from '../../types';

function formatTimeblock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hour`;
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * The detail sheet for a daily. A daily is a template plus a log, so this shows
 * its standing description (read-only — that's edited on the Dailies page), a
 * form for logging against it, and every entry logged on the day being viewed
 * with its own comment. Dailies carry no attachments, by design.
 */
export function DailyDetailModal({
  item,
  onClose,
  isBonus,
  selectedDate,
}: {
  item: DayPrioritrySummary | null;
  onClose: () => void;
  isBonus: boolean;
  /** Which day the entry lands on — the sheet can be opened on a past day. */
  selectedDate: string;
}) {
  const [blocks, setBlocks] = useState(1);
  const [comment, setComment] = useState('');
  const createEntry = useCreateEntry();
  const updateComment = useUpdateEntryComment();
  const deleteEntry = useDeleteEntry();

  if (!item) return null;

  const canAdd = item.can_repeat || item.entry_count === 0;
  // A stepper only makes sense where a unit is a span of time you can repeat.
  const isSteppable = item.timeblock !== null && item.can_repeat;

  const handleLog = () => {
    createEntry.mutate({
      prioritry_id: item.prioritry_id,
      comment: item.comments_enabled && comment.trim() ? comment.trim() : undefined,
      target_date: selectedDate,
      ...(isSteppable && blocks > 1 ? { quantity: blocks } : {}),
    });
    setComment('');
    setBlocks(1);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      subtitle={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <span>{isBonus ? 'bonus' : 'goal'}</span>
          <span>{item.point_value} pts</span>
          {item.timeblock != null && <span>{formatTimeblock(item.timeblock)}</span>}
          <span>{item.can_repeat ? 'repeatable' : 'once a day'}</span>
        </div>
      }
    >
      <ModalSection label="Description">
        <MarkdownField value={item.description} onSave={() => {}} readOnly />
        <p className="mt-1 text-xs text-gray-500">Edit this on the Dailies page.</p>
      </ModalSection>

      <ModalSection label="Log">
        {!canAdd ? (
          <p className="text-sm italic text-gray-500">
            Already logged — this one isn't repeatable.
          </p>
        ) : (
          <div className="space-y-2">
            {isSteppable && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBlocks(b => Math.max(1, b - 1))}
                  disabled={blocks <= 1}
                  title="One fewer block"
                  className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-6 text-center font-mono text-sm font-bold">{blocks}</span>
                <button
                  onClick={() => setBlocks(b => b + 1)}
                  title="One more block"
                  className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  +
                </button>
                <span className="text-xs text-gray-500">
                  {blocks} × {formatTimeblock(item.timeblock!)}
                  {blocks > 1 && ` (${formatTimeblock(item.timeblock! * blocks)})`}
                </span>
              </div>
            )}

            {item.comments_enabled && (
              <RichTextEditor
                value={comment}
                onChange={setComment}
                rows={3}
                placeholder="How did it go? Lead with #tag, to tag it"
              />
            )}

            {/* "Log" commits a block count; with no stepper there is no count to
                commit, so it reads as the same one-tap + the card offers. */}
            <button
              onClick={handleLog}
              disabled={createEntry.isPending}
              title={isSteppable ? 'Log these blocks' : 'Log one'}
              className={
                isSteppable
                  ? 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                  : 'w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white hover:bg-blue-700 disabled:opacity-50'
              }
            >
              {isSteppable ? 'Log' : '+'}
            </button>
          </div>
        )}
      </ModalSection>

      <ModalSection label={`Logged this day (${item.entry_count})`}>
        {item.entries.length === 0 ? (
          <p className="text-sm italic text-gray-500">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {item.entries.map(entry => (
              <li key={entry.id}>
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{timeOf(entry.created_at)}</span>
                  {entry.quantity > 1 && <span>×{entry.quantity} blocks</span>}
                  <button
                    onClick={() => deleteEntry.mutate(entry.id)}
                    disabled={deleteEntry.isPending}
                    className="ml-auto text-red-500 hover:underline disabled:opacity-50"
                    title="Delete this log entry"
                  >
                    delete
                  </button>
                </div>
                {item.comments_enabled && (
                  <MarkdownField
                    value={entry.comment}
                    onSave={c => updateComment.mutate({ entryId: entry.id, comment: c })}
                    placeholder="How did it go? Lead with #tag, to tag it"
                    emptyLabel="Add a comment..."
                    rows={3}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </ModalSection>
    </Modal>
  );
}
