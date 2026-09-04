import { useState } from 'react';
import { CategoryChip } from '../shared/CategorySelect';
import { useTodos, useDeleteTodo } from '../../hooks/useTodos';
import { TodoDetailModal } from '../shared/TodoDetailModal';
import type { Todo } from '../../types';

type SortField = 'created_at' | 'point_value' | 'due_date';
type SortDir = 'asc' | 'desc';

/** Timestamps (created_at, completed_at) — already carry a zone. */
function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

/** Date-only columns (due_date) — anchored at noon so the local day doesn't slip. */
function formatDateOnly(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

interface TodoLineProps {
  todo: Todo;
  /** Whatever the rightmost date column holds for this list — added date, or completion date. */
  rightDate: string;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function TodoLine({ todo, rightDate, onOpen, onDelete, deleting }: TodoLineProps) {
  return (
    <div className="px-4 py-2 hover:bg-gray-50">
      <div className="flex items-center gap-2 cursor-pointer" onClick={onOpen} title="Open details">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{todo.name}</span>
          {todo.completed_at && <span className="ml-2 text-xs text-green-600">✓</span>}
          <CategoryChip categoryId={todo.category_id} className="ml-2" />
        </div>
        <span className="w-20 text-right text-xs text-gray-500">
          {todo.due_date ? formatDateOnly(todo.due_date) : '—'}
        </span>
        <span className="w-14 text-right text-xs text-gray-500">{todo.point_value} pts</span>
        <span className="w-20 text-right text-xs text-gray-500">{rightDate}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          className="w-12 text-right text-xs text-red-500 hover:underline disabled:opacity-50 shrink-0"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function TodoList() {
  const { data: todos, isLoading } = useTodos();
  const deleteTodo = useDeleteTodo();
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'due_date', dir: 'asc' });

  if (isLoading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (!todos?.length) return <p className="text-gray-500 text-sm">No todos yet. Add one above.</p>;

  const uncompleted = todos.filter(t => t.completed_at === null);
  const completed = todos.filter(t => t.completed_at !== null);

  const sortedUncompleted = [...uncompleted].sort((a, b) => {
    let cmp: number;
    if (sort.field === 'created_at') {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sort.field === 'due_date') {
      // Undated todos sit at the bottom in either direction — they aren't "later",
      // they're just not on the clock.
      if (!a.due_date || !b.due_date) {
        if (a.due_date === b.due_date) cmp = 0;
        else return a.due_date ? -1 : 1;
      } else {
        cmp = a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      }
    } else {
      cmp = a.point_value - b.point_value;
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  // Most recently checked off first. completed_at is non-null for everything in this list.
  const sortedCompleted = [...completed].sort(
    (a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
  );

  const toggleSort = (field: SortField) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'created_at' ? 'desc' : 'asc' }
    );
  };

  const sortIcon = (field: SortField) => {
    if (sort.field !== field) return '↕';
    return sort.dir === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Uncompleted <span className="text-gray-500 font-normal">({uncompleted.length})</span>
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 font-medium">
            <div className="flex-1">Name</div>
            <button
              onClick={() => toggleSort('due_date')}
              className={`w-20 text-right hover:text-gray-700 ${sort.field === 'due_date' ? 'text-blue-600' : ''}`}
            >
              Due {sortIcon('due_date')}
            </button>
            <button
              onClick={() => toggleSort('point_value')}
              className={`w-14 text-right hover:text-gray-700 ${sort.field === 'point_value' ? 'text-blue-600' : ''}`}
            >
              Pts {sortIcon('point_value')}
            </button>
            <button
              onClick={() => toggleSort('created_at')}
              className={`w-20 text-right hover:text-gray-700 ${sort.field === 'created_at' ? 'text-blue-600' : ''}`}
            >
              Added {sortIcon('created_at')}
            </button>
            <div className="w-12"></div>
          </div>

          {sortedUncompleted.length === 0 && (
            <p className="px-4 py-2 text-sm text-gray-500">Nothing left in the queue.</p>
          )}

          {sortedUncompleted.map(t => (
            <TodoLine
              key={t.id}
              todo={t}
              rightDate={formatTimestamp(t.created_at)}
              onOpen={() => setOpenId(t.id)}
              onDelete={() => deleteTodo.mutate(t.id)}
              deleting={deleteTodo.isPending}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Completed <span className="text-gray-500 font-normal">({completed.length})</span>
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 font-medium">
            <div className="flex-1">Name</div>
            <div className="w-20 text-right">Due</div>
            <div className="w-14 text-right">Pts</div>
            <div className="w-20 text-right">Completed ↓</div>
            <div className="w-12"></div>
          </div>

          {sortedCompleted.length === 0 && (
            <p className="px-4 py-2 text-sm text-gray-500">Nothing completed yet.</p>
          )}

          {sortedCompleted.map(t => (
            <TodoLine
              key={t.id}
              todo={t}
              rightDate={formatTimestamp(t.completed_at!)}
              onOpen={() => setOpenId(t.id)}
              onDelete={() => deleteTodo.mutate(t.id)}
              deleting={deleteTodo.isPending}
            />
          ))}
        </div>
      </div>

      <TodoDetailModal todoId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
