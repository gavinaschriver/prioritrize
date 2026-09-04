import { TodoRow } from './TodoRow';
import { DeadlineRow } from './DeadlineRow';
import type { ActiveItem, DeadlineSummary, TodoSummary } from '../../types';

interface InProgressProps {
  active: ActiveItem | null | undefined;
  todos: TodoSummary[];
  deadlines: DeadlineSummary[];
  viewedDate: string;
}

/**
 * The bullpen: the single thing you're working on right now, lifted out of the
 * queue and parked above it. Renders nothing when nothing is active — an empty
 * frame would just be a permanent reminder that you aren't doing anything.
 *
 * The row itself is the ordinary card, so completing, opening and de-activating
 * all behave exactly as they do in the queue.
 */
export function InProgress({ active, todos, deadlines, viewedDate }: InProgressProps) {
  if (!active) return null;

  const todo = active.entity_type === 'todo'
    ? todos.find(t => t.id === active.entity_id && t.completed_at === null)
    : undefined;
  const deadline = active.entity_type === 'project_task'
    ? deadlines.find(d => d.id === active.entity_id && d.completed_at === null)
    : undefined;

  // The pointer can outlive what it names on a day the item isn't part of —
  // viewing last week, say. Nothing to show, so show nothing.
  if (!todo && !deadline) return null;

  return (
    <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50/40 px-2 py-1.5">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
        In progress
      </h3>
      {todo && <TodoRow item={todo} viewedDate={viewedDate} />}
      {deadline && <DeadlineRow item={deadline} viewedDate={viewedDate} />}
    </div>
  );
}
