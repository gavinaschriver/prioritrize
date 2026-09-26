import { Modal } from '../shared/Modal';
import { RefNumber } from '../shared/RefNumber';
import { DueBadge } from '../shared/DueBadge';
import { useDayPlanCandidates, usePlaceItem } from '../../hooks/useDayPlan';
import { urgencyRow, formatDueDate } from '../../lib/urgency';

interface OtherPickerProps {
  open: boolean;
  onClose: () => void;
  viewedDate: string;
}

/** Everything pending that isn't on this day yet, soonest due first -- the same
 *  order as the tracker's hybrid view. Tapping one drops it in the bank. */
export function OtherPicker({ open, onClose, viewedDate }: OtherPickerProps) {
  const { data: candidates, isLoading } = useDayPlanCandidates(viewedDate, open);
  const placeItem = usePlaceItem(viewedDate);

  const pick = (entityType: 'todo' | 'project_task', entityId: string, name: string) => {
    placeItem.mutate({ section: 'bank', slot_index: null, entity_type: entityType, entity_id: entityId, name });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Pull into the day">
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {candidates?.length === 0 && <p className="text-sm text-gray-500">Everything pending is already on this day.</p>}
      <div className="space-y-1">
        {candidates?.map(c => {
          // Coloured against the day being planned, so "due in 2 days" means from Sunday, not from now.
          const row = urgencyRow(c.due_date, viewedDate);
          return (
            <button
              key={`${c.entity_type}-${c.entity_id}`}
              onClick={() => pick(c.entity_type, c.entity_id, c.name)}
              className={`block w-full text-left py-2 hover:brightness-95 ${row.className}`}
              style={row.style}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <RefNumber number={c.ref_number} className="mr-1.5" />
                  <span className="text-sm wrap-break-word">{c.name}</span>
                  {c.project_name && <div className="text-[11px] text-gray-500">{c.project_name}</div>}
                  <DueBadge dueDate={c.due_date} viewedDate={viewedDate} />
                </div>
                <span className="w-14 shrink-0 text-xs text-gray-600 text-right">
                  {c.due_date ? formatDueDate(c.due_date) : '—'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
