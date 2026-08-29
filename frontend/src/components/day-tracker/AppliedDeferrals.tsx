import { formatDueDate } from "../../lib/urgency";
import { formatScore } from "./SectionSubtotal";
import type { DaySummary, DeadlineSummary, TodoSummary } from "../../types";

interface AppliedDeferralsProps {
  summary: DaySummary;
}

/** What a deferral cost this day, spelled out.
 *
 * These points are already inside the Tasks & Todos subtotal -- like Completed Today,
 * this is a log, not another section to add up. It exists because the cost is otherwise
 * invisible: the row that carries it sits in a collapsed section showing only a
 * subtotal, and its due date now reads as some comfortable date in the future.
 */
export function AppliedDeferrals({ summary }: AppliedDeferralsProps) {
  const items: (TodoSummary | DeadlineSummary)[] = [
    ...summary.todos.filter((t) => t.deferred),
    ...summary.deadlines.filter((d) => d.deferred),
  ].sort((a, b) => Number(a.score) - Number(b.score));

  if (items.length === 0) return null;

  const total = items.reduce((sum, i) => sum + Number(i.score), 0);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Applied Deferrals
        </h3>
        <span className="text-xs text-gray-400">already counted above</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={`${item.id}`}
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-2"
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-900 wrap-break-word">
                {item.name}
              </span>
              <p className="mt-0.5 text-xs text-gray-500">
                was due{" "}
                {item.effective_due_date
                  ? formatDueDate(item.effective_due_date)
                  : "—"}
                {", pushed to "}
                {item.due_date ? formatDueDate(item.due_date) : "no date"}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-sm font-mono font-bold text-red-600">
              {formatScore(Number(item.score))}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-1">
        <span className="text-xs text-gray-500">Total impact on this day</span>
        <span className="text-sm font-bold font-mono text-red-600">
          {formatScore(total)}
        </span>
      </div>
    </div>
  );
}
