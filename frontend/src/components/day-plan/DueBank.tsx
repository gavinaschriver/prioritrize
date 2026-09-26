import { PlanBlockCard } from './PlanBlockCard';
import { DraggableBlock, DropZone } from './dnd';
import { dragId, NEW_FREEFORM } from './blocks';
import type { PlanBlock } from '../../types';

interface DueBankProps {
  bank: PlanBlock[];
  viewedDate: string;
  isToday: boolean;
  onOpenOther: () => void;
  onOpen: (block: PlanBlock) => void;
  /** Takes a pulled-in item off the day. */
  onRemove: (block: PlanBlock) => void;
}

/** Whether the bank would show this item anyway. Those can't be removed from it --
 *  only placed -- since the bank derives them from their due date. */
function isDueOn(block: PlanBlock, viewedDate: string, isToday: boolean) {
  if (!block.due_date) return false;
  return isToday ? block.due_date <= viewedDate : block.due_date === viewedDate;
}

export function DueBank({
  bank, viewedDate, isToday, onOpenOther, onOpen, onRemove,
}: DueBankProps) {
  const label = isToday
    ? 'Due Today'
    : `Due ${new Date(viewedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}`;

  return (
    <DropZone id="bank" target={{ section: 'bank', slot_index: null }} className="mb-6 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{label}</h2>
        <div className="flex gap-2">
          <button onClick={onOpenOther} className="text-xs text-blue-600 hover:underline">+ Other…</button>
          {/* Not a click target: press (or press and hold, on a phone) and drag it onto a slot. */}
          <DraggableBlock block={NEW_FREEFORM} className="inline-block">
            <span
              title="Drag onto a slot"
              className="block select-none text-xs rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-violet-800"
            >
              ⠿ Freeform
            </span>
          </DraggableBlock>
        </div>
      </div>

      {bank.length === 0 ? (
        <p className="text-sm text-gray-500 py-1">Nothing due. Pull something in with + Other.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {bank.map(b => (
            <DraggableBlock key={dragId(b)} block={b}>
              <PlanBlockCard
                block={b}
                viewedDate={viewedDate}
                onOpen={() => onOpen(b)}
                onDismiss={b.id && !isDueOn(b, viewedDate, isToday) ? () => onRemove(b) : undefined}
              />
            </DraggableBlock>
          ))}
        </div>
      )}

    </DropZone>
  );
}
