import { useState } from 'react';
import { PlanBlockCard } from './PlanBlockCard';
import { DraggableBlock } from './dnd';
import { dragId } from './blocks';
import type { PlanBlock } from '../../types';

interface DailiesPanelProps {
  dailies: PlanBlock[];
  dismissed: PlanBlock[];
  viewedDate: string;
  onOpen: (block: PlanBlock) => void;
  onRestore: (block: PlanBlock) => void;
}

/** Dailies get their own home, apart from the day's due work. They aren't "due"
 *  the way a task is -- they're the standing routine you slot around it. Not a
 *  drop target: a daily goes back here via its × on the timeline. */
export function DailiesPanel({ dailies, dismissed, viewedDate, onOpen, onRestore }: DailiesPanelProps) {
  if (dailies.length === 0 && dismissed.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <DailiesDrawer
        title="Goals"
        tone="text-emerald-700"
        dailies={dailies.filter(b => b.daily_type !== 'Bonus')}
        dismissed={dismissed.filter(b => b.daily_type !== 'Bonus')}
        viewedDate={viewedDate}
        onOpen={onOpen}
        onRestore={onRestore}
      />
      <DailiesDrawer
        title="Bonuses"
        tone="text-orange-700"
        dailies={dailies.filter(b => b.daily_type === 'Bonus')}
        dismissed={dismissed.filter(b => b.daily_type === 'Bonus')}
        viewedDate={viewedDate}
        onOpen={onOpen}
        onRestore={onRestore}
      />
    </div>
  );
}

interface DailiesDrawerProps {
  title: string;
  /** Heading colour, echoing the blocks' fill. */
  tone: string;
  dailies: PlanBlock[];
  dismissed: PlanBlock[];
  viewedDate: string;
  onOpen: (block: PlanBlock) => void;
  onRestore: (block: PlanBlock) => void;
}

/** One collapsible run of dailies. Closed by default: there are a lot of them,
 *  and open they'd bury the day's actual deadlines. */
function DailiesDrawer({ title, tone, dailies, dismissed, viewedDate, onOpen, onRestore }: DailiesDrawerProps) {
  const [open, setOpen] = useState(false);
  if (dailies.length === 0 && dismissed.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:opacity-80 ${tone}`}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{title} ({dailies.length})</span>
      </button>
      {open && (
        <>
          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {dailies.map(b => (
              <DraggableBlock key={dragId(b)} block={b}>
                <PlanBlockCard block={b} viewedDate={viewedDate} onOpen={() => onOpen(b)} />
              </DraggableBlock>
            ))}
          </div>
          {/* Only rows hidden back when dailies had an ×; kept so they can return. */}
          {dismissed.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Hidden today:{' '}
              {dismissed.map((b, i) => (
                <span key={dragId(b)}>
                  {i > 0 && ', '}
                  <button onClick={() => onRestore(b)} title="Bring it back" className="text-blue-600 hover:underline">
                    {b.name}
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
