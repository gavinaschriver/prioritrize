import { dueBadge } from '../../lib/urgency';

interface DueBadgeProps {
  /** The date this row is actually scored against, not necessarily its own due date. */
  dueDate: string | null;
  viewedDate: string;
}

/**
 * Says out loud what the row colour only implies, once a due date is close
 * enough to act on. Renders nothing while there's still time.
 */
export function DueBadge({ dueDate, viewedDate }: DueBadgeProps) {
  const badge = dueBadge(dueDate, viewedDate);
  if (!badge) return null;

  return (
    <span
      // Its own line under the title, sized to its text — a wrapping title can't
      // strand it mid-pill, and every row's badge starts at the same left edge.
      className="mt-0.5 block w-fit whitespace-nowrap rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white"
      style={badge.style}
    >
      {badge.label}
    </span>
  );
}
