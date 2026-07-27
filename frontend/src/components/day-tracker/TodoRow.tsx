import { useCompleteTodo, useUpdateTodo } from '../../hooks/useTodos';
import { urgencyRowClass, formatDueDate } from '../../lib/urgency';
import { EditableComment } from './EditableComment';
import type { TodoSummary } from '../../types';

interface TodoRowProps {
  item: TodoSummary;
  viewedDate: string;
}

export function TodoRow({ item, viewedDate }: TodoRowProps) {
  const completeTodo = useCompleteTodo();
  const updateTodo = useUpdateTodo();

  const score = Number(item.score);
  // Nothing is riding on it yet — no due date, or the due date hasn't arrived
  const scoreDisplay = item.is_upcoming ? '—' : score > 0 ? `+${score}` : String(score);
  const scoreColor = item.is_upcoming ? 'text-gray-400' : score > 0 ? 'text-green-600' : 'text-red-600';

  const addedDate = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  const dueLabel = item.due_date ? formatDueDate(item.due_date) : null;

  return (
    <div className={`py-2 ${urgencyRowClass(item.due_date, viewedDate)}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-sm">{item.name}</span>
          <span className="ml-2 text-xs text-gray-400">{addedDate}</span>
          {dueLabel && <span className="ml-1 text-xs text-gray-400">· due {dueLabel}</span>}
        </div>
        <span className="text-xs text-gray-300 shrink-0">todo</span>
        <button
          onClick={() => completeTodo.mutate(item.id)}
          disabled={completeTodo.isPending}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Mark complete"
        >✓</button>
        <span className="w-12 text-right text-sm font-mono">{item.point_value}</span>
        <span className={`w-14 text-right text-sm font-mono font-bold ${scoreColor}`}>
          {scoreDisplay}
        </span>
      </div>
      <EditableComment
        value={item.comment}
        onSave={comment => updateTodo.mutate({ id: item.id, data: { comment } })}
      />
    </div>
  );
}
