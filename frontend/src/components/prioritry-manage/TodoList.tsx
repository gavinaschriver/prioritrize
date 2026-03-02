import { useTodos, useDeleteTodo } from '../../hooks/useTodos';

export function TodoList() {
  const { data: todos, isLoading } = useTodos();
  const deleteTodo = useDeleteTodo();

  if (isLoading) return <p className="text-gray-400 text-sm">Loading...</p>;
  if (!todos?.length) return <p className="text-gray-400 text-sm">No todos yet. Add one above.</p>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {todos.map(t => (
        <div key={t.id} className="flex items-center justify-between px-4 py-2">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{t.name}</span>
            <span className="ml-2 text-xs text-gray-400">{t.point_value} pts</span>
            {t.completed_at && (
              <span className="ml-2 text-xs text-green-600">✓ completed</span>
            )}
          </div>
          <button
            onClick={() => deleteTodo.mutate(t.id)}
            disabled={deleteTodo.isPending}
            className="text-xs text-red-500 hover:underline disabled:opacity-50 shrink-0"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
