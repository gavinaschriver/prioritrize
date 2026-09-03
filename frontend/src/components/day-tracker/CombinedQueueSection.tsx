import { useState } from 'react';
import { TodoRow } from './TodoRow';
import { DeadlineRow } from './DeadlineRow';
import { SectionSubtotal, formatScore } from './SectionSubtotal';
import type { DeadlineSummary, TodoSummary } from '../../types';

/** Rows revealed per click. The queue is a working list, not an archive — it
 *  opens at one screenful and grows on request. */
const PAGE = 10;

type SortField = 'created_at' | 'point_value' | 'due_date';
type SortDir = 'asc' | 'desc';

type QueueItem =
  | { kind: 'todo'; item: TodoSummary }
  | { kind: 'deadline'; item: DeadlineSummary };

interface CombinedQueueSectionProps {
  todos: TodoSummary[];
  deadlines: DeadlineSummary[];
  viewedDate: string;
  open: boolean;
  onToggle: () => void;
}

/** Everything actionable that isn't a daily — todos and project tasks in one list. */
export function CombinedQueueSection({ todos, deadlines, viewedDate, open, onToggle }: CombinedQueueSectionProps) {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'due_date', dir: 'asc' });
  const [visibleCount, setVisibleCount] = useState(PAGE);

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

  // Re-sorting reorders what you're looking at rather than starting a new list,
  // so however far you've paged through it stays paged.
  const visible = sorted.slice(0, visibleCount);
  const remaining = sorted.length - visible.length;

  const sortIcon = (field: SortField) =>
    sort.field !== field ? '↕' : sort.dir === 'asc' ? '↑' : '↓';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>Tasks and Todos</span>
        </button>
        {!open && (
          <span className={`text-sm font-bold font-mono ${subtotalColor}`}>{formatScore(subtotal)}</span>
        )}
      </div>
      {open && (
        <>
          <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-500 font-medium px-0 mb-1">
            <div className="flex-1 min-w-0">Name</div>
            <button
              onClick={() => toggleSort('due_date')}
              className={`w-14 sm:w-24 shrink-0 text-left hover:text-gray-700 ${sort.field === 'due_date' ? 'text-blue-600' : ''}`}
            >
              Due {sortIcon('due_date')}
            </button>
            <button
              onClick={() => toggleSort('created_at')}
              className={`w-16 sm:w-20 shrink-0 text-left hover:text-gray-700 ${sort.field === 'created_at' ? 'text-blue-600' : ''}`}
            >
              Added {sortIcon('created_at')}
            </button>
            <div className="hidden sm:block w-40 shrink-0"></div>
            <button
              onClick={() => toggleSort('point_value')}
              className={`w-9 sm:w-14 shrink-0 text-right hover:text-gray-700 ${sort.field === 'point_value' ? 'text-blue-600' : ''}`}
            >
              Pts {sortIcon('point_value')}
            </button>
            <div className="w-10 sm:w-14 text-right shrink-0">Score</div>
          </div>

          {pending.length === 0 && (
            <p className="text-sm text-gray-500 py-2">Nothing on your plate.</p>
          )}

          <div className="space-y-1">
            {visible.map(q =>
              q.kind === 'todo' ? (
                <TodoRow key={`todo-${q.item.id}`} item={q.item} viewedDate={viewedDate} />
              ) : (
                <DeadlineRow key={`${q.item.type}-${q.item.id}`} item={q.item} viewedDate={viewedDate} />
              )
            )}
          </div>

          {(remaining > 0 || visibleCount > PAGE) && (
            <div className="flex items-center gap-3 mt-2">
              {remaining > 0 && (
                <button
                  onClick={() => setVisibleCount(c => c + PAGE)}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Show {Math.min(PAGE, remaining)} more ({remaining} left)
                </button>
              )}
              {visibleCount > PAGE && (
                <button
                  onClick={() => setVisibleCount(PAGE)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Show less
                </button>
              )}
            </div>
          )}

          <SectionSubtotal label="Today's Tasks & Todos Score" value={subtotal} />
        </>
      )}
    </div>
  );
}
