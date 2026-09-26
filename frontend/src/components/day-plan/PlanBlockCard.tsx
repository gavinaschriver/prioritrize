import { RefNumber } from '../shared/RefNumber';
import { DueBadge } from '../shared/DueBadge';
import { useState } from 'react';
import { AddDetailsButton, PlanNote } from './PlanNote';
import type { PlanBlock, PlanEntityType } from '../../types';

// Calendar-style fills, one per kind, so a glance at the timeline says what's what.
const KIND_STYLES: Record<Exclude<PlanEntityType, 'prioritry'>, string> = {
  todo: 'bg-orange-500 text-white',
  project_task: 'bg-sky-600 text-white',
  freeform: 'bg-violet-100 text-violet-900 border border-violet-300',
};
// Dailies split by type: goals green, bonuses a light orange (todos own the
// strong orange). Yellow is reserved for "scheduled".
const GOAL_STYLE = 'bg-emerald-600 text-white';
const BONUS_STYLE = 'bg-orange-300 text-orange-950';
// A repeatable daily in its drawer that already has a session slotted: you can
// still drag another one in.
const SCHEDULED_STYLE = 'bg-yellow-300 text-yellow-950';

const styleFor = (block: PlanBlock) => {
  if (block.entity_type !== 'prioritry') return KIND_STYLES[block.entity_type];
  if (block.section === 'bank' && block.can_repeat && block.scheduled_count > 0) return SCHEDULED_STYLE;
  return block.daily_type === 'Bonus' ? BONUS_STYLE : GOAL_STYLE;
};

interface PlanBlockCardProps {
  block: PlanBlock;
  viewedDate: string;
  /** Opens the item's detail sheet. Absent on the drag overlay. */
  onOpen?: () => void;
  /** Shows an ×. What it does is the caller's call; say so in dismissLabel. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Makes the session note editable. Scheduled dailies only. */
  onEditNote?: (note: string) => void;
}

export function PlanBlockCard({
  block, viewedDate, onOpen, onDismiss, dismissLabel = 'Remove from this day', onEditNote,
}: PlanBlockCardProps) {
  const done = block.completed_at !== null || block.logged;
  const [editingNote, setEditingNote] = useState(false);

  const finishNote = (note: string | null) => {
    setEditingNote(false);
    if (note !== null && note.trim() !== (block.note ?? '')) onEditNote?.(note);
  };

  return (
    <div
      onClick={onOpen}
      className={`relative rounded-md px-2 py-1.5 text-sm shadow-sm ${styleFor(block)} ${done ? 'opacity-60' : ''} ${onDismiss ? 'pr-7' : ''}`}
    >
      {onDismiss && (
        <button
          type="button"
          // Its own click, not the card's: dismissing shouldn't also open the sheet.
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          title={dismissLabel}
          className="absolute top-1 right-1 h-5 w-5 rounded leading-none opacity-70 hover:opacity-100 hover:bg-black/15"
        >
          ×
        </button>
      )}
      <div className="flex items-baseline gap-1.5 min-w-0">
        {block.ref_number != null && (
          // RefNumber's gray is for white rows; lift it off the coloured fill.
          <RefNumber number={block.ref_number} className="text-white/80! hover:text-white!" />
        )}
        <span className={`wrap-break-word ${done ? 'line-through' : ''}`}>
          {block.name || <span className="italic opacity-60">Untitled</span>}
        </span>
        {onEditNote && !block.note && !editingNote && <AddDetailsButton onClick={() => setEditingNote(true)} />}
      </div>
      {block.project_name && <div className="text-[11px] opacity-80 truncate">{block.project_name}</div>}
      <PlanNote
        note={block.note}
        editing={editingNote}
        onStartEdit={onEditNote ? () => setEditingNote(true) : undefined}
        onFinish={finishNote}
      />
      {!done && <DueBadge dueDate={block.due_date} viewedDate={viewedDate} />}
    </div>
  );
}
