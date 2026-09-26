import { PlanBlockCard } from './PlanBlockCard';
import { DraggableBlock, DropZone } from './dnd';
import { FreeformBlock } from './FreeformBlock';
import { isPending } from './blocks';
import type { PlanBlock, TimelineSection as SectionKey } from '../../types';

interface TimelineSectionProps {
  section: SectionKey;
  label: string;
  start: string;
  end: string;
  /** This section's blocks, positioned by slot_index. */
  blocks: PlanBlock[];
  /** How many slots the section has on this day (the server's count). */
  slotCount: number;
  viewedDate: string;
  onOpen: (block: PlanBlock) => void;
  onSaveFreeform: (block: PlanBlock, text: string) => void;
  onRemove: (block: PlanBlock) => void;
  /** Sends a block back where it came from: Due Today, or its dailies drawer. */
  onClear: (block: PlanBlock) => void;
  onRemoveSlot: (slotIndex: number) => void;
}

export function TimelineSection({
  section, label, start, end, blocks, slotCount: storedCount, viewedDate,
  onOpen, onSaveFreeform, onRemove, onClear, onRemoveSlot,
}: TimelineSectionProps) {
  const bySlot = new Map(blocks.map(b => [b.slot_index, b]));
  // The server already never undercounts, but a block dropped on the add zone
  // arrives optimistically before the new count does.
  const slotCount = Math.max(storedCount, ...blocks.map(b => (b.slot_index ?? 0) + 1));

  return (
    <div className="flex border-t border-gray-200">
      {/* The calendar gutter: a name and a loose time range, no hour lines. */}
      <div className="w-20 sm:w-24 shrink-0 py-2 pr-2 text-right">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</div>
        <div className="text-[11px] text-gray-500">{start} – {end}</div>
      </div>
      <div className="flex-1 min-w-0 border-l border-gray-200 py-2 pl-2 space-y-1.5">
        {Array.from({ length: slotCount }, (_, slotIndex) => {
          const block = bySlot.get(slotIndex);
          return (
            <DropZone
              key={slotIndex}
              id={`slot:${section}:${slotIndex}`}
              target={{ section, slot_index: slotIndex }}
              className="min-h-11"
            >
              {block?.entity_type === 'freeform' ? (
                <FreeformBlock
                  // No key: when the pending id becomes the real one, this must stay
                  // the same component, or it would drop whatever's been typed so far.
                  block={block}
                  viewedDate={viewedDate}
                  onSave={text => onSaveFreeform(block, text)}
                  onRemove={() => onRemove(block)}
                />
              ) : block ? (
                <DraggableBlock block={block}>
                  <PlanBlockCard
                    block={block}
                    viewedDate={viewedDate}
                    onOpen={() => onOpen(block)}
                    onDismiss={isPending(block) ? undefined : () => onClear(block)}
                    dismissLabel={block.entity_type === 'prioritry' ? 'Back to dailies' : 'Back to Due Today'}
                  />
                </DraggableBlock>
              ) : (
                <div className="group relative h-11 rounded-md border border-dashed border-gray-200">
                  <button
                    type="button"
                    onClick={() => onRemoveSlot(slotIndex)}
                    title="Remove this empty slot"
                    // Always visible on touch screens; on a mouse, only on hover.
                    className="absolute top-1 right-1 h-5 w-5 rounded leading-none text-gray-400 hover:text-gray-700 hover:bg-gray-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              )}
            </DropZone>
          );
        })}
        {/* One past the last slot: dropping here makes a new slot. To handleDrop
            it's just an empty slot at index slotCount. */}
        <DropZone
          id={`slot:${section}:${slotCount}`}
          target={{ section, slot_index: slotCount }}
        >
          <div className="flex h-7 items-center justify-center rounded-md text-[11px] text-gray-400">
            + drop here for a new slot
          </div>
        </DropZone>
      </div>
    </div>
  );
}
