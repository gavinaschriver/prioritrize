import { formatDueDate } from "../../lib/urgency";

interface DeferredBadgeProps {
  /** The due date this day was actually scored against, not the item's current one. */
  effectiveDueDate: string | null;
}

// Marks a row whose dock is owed to a deferral rather than to its current due date.
// Without it the row reads as a bug: a red score sitting next to a due date that
// hasn't arrived yet, with nothing to explain the gap.
export function DeferredBadge({ effectiveDueDate }: DeferredBadgeProps) {
  const title = effectiveDueDate
    ? `Penalty locked in. This was due ${formatDueDate(effectiveDueDate)} and was pushed back while already due, so the days it had been costing you keep costing you.`
    : "Penalty locked in. This was already due when it was pushed back, so the days it had been costing you keep costing you.";

  return (
    <span
      className="ml-1.5 shrink-0 rounded border border-red-300 bg-red-50 px-1 py-px align-middle text-[10px] font-medium text-red-700"
      title={title}
    >
      deferred
    </span>
  );
}
