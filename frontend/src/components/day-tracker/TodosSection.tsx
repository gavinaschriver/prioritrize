import { useState } from 'react';
import { TodoRow } from './TodoRow';
import type { TodoSummary } from '../../types';

interface TodosSectionProps {
  todos: TodoSummary[];
  subtotal: number;
}

export function TodosSection({ todos, subtotal }: TodosSectionProps) {
  const [open, setOpen] = useState(true);
  const subtotalColor = subtotal >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>Todos</span>
        </button>
        <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
          {subtotal >= 0 ? '+' : ''}{subtotal % 1 === 0 ? subtotal : Number(subtotal).toFixed(1)}
        </span>
      </div>
      {open && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-0 mb-1">
            <div className="flex-1">Name</div>
            <div className="w-8"></div>
            <div className="w-12 text-right">Pts</div>
            <div className="w-14 text-right">Score</div>
          </div>
          {todos.length === 0 && (
            <p className="text-sm text-gray-400 py-2">No active todos. Add some in Manage Todos.</p>
          )}
          {todos.map(t => (
            <TodoRow key={t.id} item={t} />
          ))}
          <div className="flex justify-end pt-2 border-t border-gray-200 mt-1">
            <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
              {subtotal >= 0 ? '+' : ''}{subtotal % 1 === 0 ? subtotal : Number(subtotal).toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
