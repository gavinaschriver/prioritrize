import { useCompleteTodo } from '../../hooks/useTodos';
import type { TodoSummary } from '../../types';

function urgencyRowClass(item: TodoSummary): string {
  const base = 'rounded-lg px-2 -mx-2';
  const isCompleted = item.completed_at !== null;
  if (isCompleted) return `bg-green-50 border border-green-200 ${base}`;
  if (!item.due_date) return `bg-red-50 border border-red-200 ${base}`;

  const now = Date.now();
  const created = new Date(item.created_at).getTime();
  const due = new Date(item.due_date + 'T23:59:59').getTime();
  const total = due - created;
  const pct = total > 0 ? (now - created) / total : 1;

  if (pct >= 1) return `bg-red-50 border border-red-200 ${base}`;
  if (pct >= 0.75) return `bg-orange-50 border border-orange-200 ${base}`;
  return `bg-yellow-50 border border-yellow-200 ${base}`;
}

interface TodoRowProps {
  item: TodoSummary;
}

export function TodoRow({ item }: TodoRowProps) {
  const completeTodo = useCompleteTodo();
  const score = Number(item.score);
  const scoreColor = score > 0 ? 'text-green-600' : score < 0 ? 'text-red-600' : 'text-gray-500';
  const isCompleted = item.completed_at !== null;
  const rowBg = urgencyRowClass(item);

  const addedDate = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  const dueLabel = item.due_date
    ? new Date(item.due_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className={`py-2 ${rowBg}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-sm">{item.name}</span>
          <span className="ml-2 text-xs text-gray-400">{addedDate}</span>
          {dueLabel && <span className="ml-1 text-xs text-gray-400">· due {dueLabel}</span>}
        </div>
        <button
          onClick={() => completeTodo.mutate(item.id)}
          disabled={isCompleted || completeTodo.isPending}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title={isCompleted ? 'Completed' : 'Mark complete'}
        >✓</button>
        <span className="w-12 text-right text-sm font-mono">{item.point_value}</span>
        <span className={`w-14 text-right text-sm font-mono font-bold ${scoreColor}`}>
          {score > 0 ? '+' : ''}{score % 1 === 0 ? score : score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
