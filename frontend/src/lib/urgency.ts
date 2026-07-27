/** Whole days from the viewed day to the due date. Negative means overdue. */
function daysUntil(dueDate: string, viewedDate: string): number {
  const due = new Date(dueDate + 'T12:00:00').getTime();
  const viewed = new Date(viewedDate + 'T12:00:00').getTime();
  return Math.round((due - viewed) / 86400000);
}

// Row styling for anything in a queue (todos, project tasks) — driven purely by how
// close the due date is, relative to the day being viewed. Completed items never reach
// here; they move out of the queue and into the Completed Today list.
export function urgencyRowClass(dueDate: string | null, viewedDate: string): string {
  const base = 'rounded-lg px-2 -mx-2 border';
  if (!dueDate) return `${base} bg-gray-50 border-gray-200`;

  const days = daysUntil(dueDate, viewedDate);
  if (days < 0) return `${base} bg-red-100 border-red-400`;        // overdue
  if (days === 0) return `${base} bg-red-50 border-red-200`;       // due today
  if (days === 1) return `${base} bg-yellow-100 border-yellow-400`; // due tomorrow
  if (days === 2) return `${base} bg-yellow-50 border-yellow-200`;  // due in two days
  return `${base} bg-green-50 border-green-200`;                    // dated, but there's time
}

/** "Jul 28" — the same shape everywhere a due date is shown. */
export function formatDueDate(dueDate: string): string {
  return new Date(dueDate + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
