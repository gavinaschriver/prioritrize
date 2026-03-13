import { useState } from 'react';
import { useTodos, useDeleteTodo, useUpdateTodo } from '../../hooks/useTodos';
import type { Todo } from '../../types';

type SortField = 'created_at' | 'point_value' | 'due_date';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

interface InlineEditProps {
  todo: Todo;
  onDone: () => void;
}

function InlineEdit({ todo, onDone }: InlineEditProps) {
  const [name, setName] = useState(todo.name);
  const [pointValue, setPointValue] = useState(String(todo.point_value));
  const [dueDate, setDueDate] = useState(todo.due_date ?? '');
  const [error, setError] = useState('');
  const updateTodo = useUpdateTodo();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = parseInt(pointValue);
    if (isNaN(parsed) || parsed < 0) {
      setError('Must be >= 0');
      return;
    }
    try {
      await updateTodo.mutateAsync({ id: todo.id, data: { name, point_value: parsed, due_date: dueDate || null } });
      onDone();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-50 flex-wrap">
      {error && <span className="text-xs text-red-600 w-full">{error}</span>}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="flex-1 min-w-32 px-2 py-1 text-sm border border-gray-300 rounded"
        autoFocus
      />
      <input
        type="number"
        min={0}
        value={pointValue}
        onChange={e => setPointValue(e.target.value)}
        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
        placeholder="pts"
      />
      <input
        type="date"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        className="w-36 px-2 py-1 text-sm border border-gray-300 rounded"
      />
      <button type="submit" disabled={updateTodo.isPending} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
        Save
      </button>
      <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:underline">
        Cancel
      </button>
    </form>
  );
}

export function TodoList() {
  const { data: todos, isLoading } = useTodos();
  const deleteTodo = useDeleteTodo();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'created_at', dir: 'desc' });

  if (isLoading) return <p className="text-gray-400 text-sm">Loading...</p>;
  if (!todos?.length) return <p className="text-gray-400 text-sm">No todos yet. Add one above.</p>;

  const sorted = [...todos].sort((a, b) => {
    let cmp: number;
    if (sort.field === 'created_at') {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sort.field === 'due_date') {
      const aD = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bD = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      cmp = aD - bD;
    } else {
      cmp = a.point_value - b.point_value;
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'point_value' ? 'asc' : 'desc' }
    );
  };

  const sortIcon = (field: SortField) => {
    if (sort.field !== field) return '↕';
    return sort.dir === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 font-medium">
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

      {sorted.map(t => (
        <div key={t.id}>
          {editingId === t.id ? (
            <InlineEdit todo={t} onDone={() => setEditingId(null)} />
          ) : (
            <div
              className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-50"
              onClick={() => setEditingId(t.id)}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{t.name}</span>
                {t.completed_at && <span className="ml-2 text-xs text-green-600">✓</span>}
              </div>
              <span className="w-20 text-right text-xs text-gray-400">
                {t.due_date ? formatDate(t.due_date) : '—'}
              </span>
              <span className="w-14 text-right text-xs text-gray-500">{t.point_value} pts</span>
              <span className="w-20 text-right text-xs text-gray-400">{formatDate(t.created_at)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteTodo.mutate(t.id); }}
                disabled={deleteTodo.isPending}
                className="w-12 text-right text-xs text-red-500 hover:underline disabled:opacity-50 shrink-0"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
