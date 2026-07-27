import { useState } from "react";
import { DeadlineRow } from "./DeadlineRow";
import { SectionSubtotal, formatScore } from './SectionSubtotal';
import type { DeadlineSummary } from "../../types";

const DEFAULT_VISIBLE = 5;

interface DeadlinesSectionProps {
  deadlines: DeadlineSummary[];
  viewedDate: string;
}

export function DeadlinesSection({
  deadlines,
  viewedDate,
}: DeadlinesSectionProps) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Completed items leave the queue for the Completed Today list, so the subtotal
  // shown here is always the sum of the rows you can see.
  const pending = deadlines.filter((d) => d.completed_at === null);
  const subtotal = pending.reduce((sum, d) => sum + Number(d.score), 0);
  const subtotalColor = subtotal >= 0 ? "text-green-600" : "text-red-600";
  const visible = showAll ? pending : pending.slice(0, DEFAULT_VISIBLE);
  const hasMore = pending.length > DEFAULT_VISIBLE;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>Tasks</span>
        </button>
        {!open && (
          <span className={`text-sm font-bold font-mono ${subtotalColor}`}>{formatScore(subtotal)}</span>
        )}
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

          {pending.length === 0 && (
            <p className="text-sm text-gray-400 py-2">
              Nothing left in the queue. Add projects or tasks to fill it.
            </p>
          )}

          <div className="space-y-1">
            {visible.map((d) => (
              <DeadlineRow
                key={`${d.type}-${d.id}`}
                item={d}
                viewedDate={viewedDate}
              />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="mt-2 text-xs text-blue-500 hover:underline"
            >
              {showAll
                ? "Show less"
                : `Show ${pending.length - DEFAULT_VISIBLE} more`}
            </button>
          )}

          <SectionSubtotal label="Today's Tasks Score" value={subtotal} />
        </>
      )}
    </div>
  );
}
