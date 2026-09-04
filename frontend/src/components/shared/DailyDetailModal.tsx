import { useUpdateEntryComment, useDeleteEntry } from '../../hooks/useEntries';
import { Modal, ModalSection } from './Modal';
import { MarkdownField } from './MarkdownField';
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
 * its standing description (read-only — that's edited on the Dailies page) and
 * every entry logged on the day being viewed, each with its own comment.
 * Dailies carry no attachments, by design.
 */
export function DailyDetailModal({
  item,
  onClose,
  isBonus,
}: {
  item: DayPrioritrySummary | null;
  onClose: () => void;
  isBonus: boolean;
}) {
  const updateComment = useUpdateEntryComment();
  const deleteEntry = useDeleteEntry();

  if (!item) return null;

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

      <ModalSection label={`Logged this day (${item.entry_count})`}>
        {item.entries.length === 0 ? (
          <p className="text-sm italic text-gray-500">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {item.entries.map(entry => (
              <li key={entry.id} className="rounded-lg border border-gray-200 p-2">
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
                <MarkdownField
                  value={entry.comment}
                  onSave={comment => updateComment.mutate({ entryId: entry.id, comment })}
                  placeholder="How did it go?"
                  emptyLabel="Add a comment..."
                  rows={3}
                />
              </li>
            ))}
          </ul>
        )}
      </ModalSection>
    </Modal>
  );
}
