import { useState } from 'react';

// The card is a drag handle and a click target. Presses on the note's controls
// must be their own, or typing would start drags and clicks would open the sheet.
const keepToSelf = (e: React.SyntheticEvent) => e.stopPropagation();
const ownPresses = { onMouseDown: keepToSelf, onTouchStart: keepToSelf };

/** The inline "+ Details" beside a scheduled daily's name, shown until it has a note. */
export function AddDetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { keepToSelf(e); onClick(); }}
      {...ownPresses}
      className="ml-3 shrink-0 text-xs opacity-60 hover:opacity-100 hover:underline"
    >
      + Details
    </button>
  );
}

interface PlanNoteProps {
  note: string | null;
  editing: boolean;
  onStartEdit?: () => void;
  /** null means cancelled. */
  onFinish: (note: string | null) => void;
}

/** The line under a scheduled daily: what it'll be, specifically. Tap to edit. */
export function PlanNote({ note, editing, onStartEdit, onFinish }: PlanNoteProps) {
  const [draft, setDraft] = useState(note ?? '');

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => onFinish(draft)}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(note ?? ''); onFinish(null); }
        }}
        onClick={keepToSelf}
        {...ownPresses}
        placeholder="e.g. long walk"
        className="mt-1 block w-full rounded bg-white/90 px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/60"
      />
    );
  }

  if (!note) return null;
  return (
    <button
      type="button"
      onClick={e => { keepToSelf(e); onStartEdit?.(); }}
      {...ownPresses}
      disabled={!onStartEdit}
      title={onStartEdit ? 'Edit details' : undefined}
      className="mt-0.5 block text-left text-xs italic opacity-90 enabled:hover:underline"
    >
      {note}
    </button>
  );
}
