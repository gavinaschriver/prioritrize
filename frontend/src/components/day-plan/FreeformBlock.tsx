import { useState } from 'react';
import { PlanBlockCard } from './PlanBlockCard';
import { DraggableBlock } from './dnd';
import { isPending } from './blocks';
import type { PlanBlock } from '../../types';

interface FreeformBlockProps {
  block: PlanBlock;
  viewedDate: string;
  onSave: (text: string) => void;
  onRemove: () => void;
}

/** A freeform block edits in place rather than opening a sheet -- there's no item
 *  behind it, just the text. A fresh one (no text yet) opens straight into editing. */
export function FreeformBlock({ block, viewedDate, onSave, onRemove }: FreeformBlockProps) {
  const [editing, setEditing] = useState(block.name === '');
  const [draft, setDraft] = useState(block.name);

  const finish = () => {
    const text = draft.trim();
    // Walked away without writing anything: the block was never really wanted.
    if (!text) {
      if (!isPending(block)) onRemove();
      return;
    }
    // Still waiting on the server for a real id; keep editing until it lands.
    if (isPending(block)) return;
    setEditing(false);
    if (text !== block.name) onSave(text);
  };

  if (editing) {
    // Outside DraggableBlock on purpose: selecting text with the mouse would
    // otherwise read as a drag.
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { setDraft(block.name); e.currentTarget.blur(); }
        }}
        placeholder="e.g. meditate / self-care"
        rows={2}
        className="block w-full rounded-md border border-violet-300 bg-violet-50 px-2 py-1.5 text-sm text-violet-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
    );
  }

  return (
    <DraggableBlock block={block}>
      <PlanBlockCard
        block={block}
        viewedDate={viewedDate}
        onOpen={() => setEditing(true)}
        onDismiss={isPending(block) ? undefined : onRemove}
        dismissLabel="Delete"
      />
    </DraggableBlock>
  );
}
