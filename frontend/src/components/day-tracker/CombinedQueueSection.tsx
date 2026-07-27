import { useState } from 'react';
import { TodoRow } from './TodoRow';
import { DeadlineRow } from './DeadlineRow';
import { SectionSubtotal, formatScore } from './SectionSubtotal';
import type { DeadlineSummary, TodoSummary } from '../../types';

type SortField = 'created_at' | 'point_value' | 'due_date';
type SortDir = 'asc' | 'desc';

type QueueItem =
  | { kind: 'todo'; item: TodoSummary }
  | { kind: 'deadline'; item: DeadlineSummary };

interface CombinedQueueSectionProps {
  todos: TodoSummary[];
  deadlines: DeadlineSummary[];
  viewedDate: string;
}

/** Everything actionable that isn't a daily — todos and project tasks in one list. */
export function CombinedQueueSection({ todos, deadlines, viewedDate }: CombinedQueueSectionProps) {
  const [open, setOpen] = useState(true);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'due_date', dir: 'asc' });

  const pending: QueueItem[] = [
    ...todos.filter(t => t.completed_at === null).map(item => ({ kind: 'todo' as const, item })),
    ...deadlines.filter(d => d.completed_at === null).map(item => ({ kind: 'deadline' as const, item })),
  ];

  const subtotal = pending.reduce((sum, q) => sum + Number(q.item.score), 0);
  const subtotalColor = subtotal >= 0 ? 'text-green-600' : 'text-red-600';

  const toggleSort = (field: SortField) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'created_at' ? 'desc' : 'asc' }
    );
  };

  const sorted = [...pending].sort((a, b) => {
    let cmp: number;
    if (sort.field === 'created_at') {
      cmp = new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime();
    } else if (sort.field === 'due_date') {
      // Undated items sit at the bottom regardless of direction — they aren't "later",
      // they're just not on the clock.
      if (!a.item.due_date || !b.item.due_date) {
        if (a.item.due_date === b.item.due_date) cmp = 0;
        else return a.item.due_date ? -1 : 1;
      } else {
        cmp = a.item.due_date < b.item.due_date ? -1 : a.item.due_date > b.item.due_date ? 1 : 0;
      }
    } else {
      cmp = (a.item.point_value ?? 0) - (b.item.point_value ?? 0);
    }
    if (cmp === 0) cmp = new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime();
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const sortIcon = (field: SortField) =>
    sort.field !== field ? '↕' : sort.dir === 'asc' ? '↑' : '↓';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
          >
            <span>{open ? '▾' : '▸'}</span>
            <span>Tasks and Todos</span>
          </button>
          {(['point_value', 'created_at', 'due_date'] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`text-xs px-1 rounded hover:text-gray-700 ${sort.field === field ? 'text-blue-600 font-medium' : 'text-gray-400'}`}
            >
              {field === 'point_value' ? 'pts' : field === 'created_at' ? 'added' : 'due'} {sortIcon(field)}
            </button>
          ))}
        </div>
        {!open && (
          <span className={`text-sm font-bold font-mono ${subtotalColor}`}>{formatScore(subtotal)}</span>
        )}
      </div>
      {open && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-0 mb-1">
            <div className="flex-1">Name</div>
            <div className="w-12 text-right">Pts</div>
            <div className="w-14 text-right">Score</div>
          </div>

          {pending.length === 0 && (
            <p className="text-sm text-gray-400 py-2">Nothing on your plate.</p>
          )}

          <div className="space-y-1">
            {sorted.map(q =>
              q.kind === 'todo' ? (
                <TodoRow key={`todo-${q.item.id}`} item={q.item} viewedDate={viewedDate} />
              ) : (
                <DeadlineRow key={`${q.item.type}-${q.item.id}`} item={q.item} viewedDate={viewedDate} />
              )
            )}
          </div>

          <SectionSubtotal label="Today's Tasks & Todos Score" value={subtotal} />
        </>
      )}
    </div>
  );
}
