import { useState } from 'react';
import { DeadlineRow } from './DeadlineRow';
import type { DeadlineSummary } from '../../types';

const DEFAULT_VISIBLE = 5;

interface DeadlinesSectionProps {
  deadlines: DeadlineSummary[];
  subtotal: number;
}

export function DeadlinesSection({ deadlines, subtotal }: DeadlinesSectionProps) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const subtotalColor = subtotal >= 0 ? 'text-green-600' : 'text-red-600';
  const visible = showAll ? deadlines : deadlines.slice(0, DEFAULT_VISIBLE);
  const hasMore = deadlines.length > DEFAULT_VISIBLE;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>Upcoming Deadlines</span>
        </button>
        <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
          {subtotal >= 0 ? '+' : ''}{subtotal % 1 === 0 ? subtotal : Number(subtotal).toFixed(1)}
        </span>
      </div>
      {open && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-0 mb-1">
            <div className="flex-1">Name</div>
            <div className="w-10 text-right"></div>
            <div className="w-8"></div>
            <div className="w-12 text-right">Pts</div>
            <div className="w-14 text-right">Score</div>
          </div>

          {deadlines.length === 0 && (
            <p className="text-sm text-gray-400 py-2">No deadline items. Add projects or tasks with due dates.</p>
          )}

          {visible.map(d => (
            <DeadlineRow key={`${d.type}-${d.id}`} item={d} />
          ))}

          {hasMore && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="mt-2 text-xs text-blue-500 hover:underline"
            >
              {showAll ? 'Show less' : `Show ${deadlines.length - DEFAULT_VISIBLE} more`}
            </button>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-200 mt-1">
            <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
              {subtotal >= 0 ? '+' : ''}{subtotal % 1 === 0 ? subtotal : Number(subtotal).toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
