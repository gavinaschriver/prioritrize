import { useState } from 'react';
import { useCompleteTodo, useUpdateTodo } from '../../hooks/useTodos';
import { urgencyRowClass, formatDueDate } from '../../lib/urgency';
import { EditableComment } from './EditableComment';
import { ConvertTodoToTask } from '../shared/ConvertTodoToTask';
import type { TodoSummary } from '../../types';

interface TodoRowProps {
  item: TodoSummary;
  viewedDate: string;
}

export function TodoRow({ item, viewedDate }: TodoRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPts, setEditPts] = useState(String(item.point_value));
  const [editDue, setEditDue] = useState(item.due_date ?? '');

  const completeTodo = useCompleteTodo();
  const updateTodo = useUpdateTodo();

  const score = Number(item.score);
  // Nothing is riding on it yet — no due date, or the due date hasn't arrived
  const scoreDisplay = item.is_upcoming ? '—' : score > 0 ? `+${score}` : String(score);
  const scoreColor = item.is_upcoming ? 'text-gray-400' : score > 0 ? 'text-green-600' : 'text-red-600';
  const rowBg = urgencyRowClass(item.due_date, viewedDate);

  const addedDate = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  const dueLabel = item.due_date ? formatDueDate(item.due_date) : null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pts = editPts.trim() !== '' ? parseInt(editPts) : 0;
    await updateTodo.mutateAsync({
      id: item.id,
      data: { name: editName, point_value: isNaN(pts) ? 0 : pts, due_date: editDue || null },
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`py-2 ${rowBg}`}>
        <form onSubmit={handleSaveEdit} className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            required
            autoFocus
            className="flex-1 min-w-32 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <input
            type="number"
            min={0}
            value={editPts}
            onChange={e => setEditPts(e.target.value)}
            placeholder="pts"
            className="w-14 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <input
            type="date"
            value={editDue}
            onChange={e => setEditDue(e.target.value)}
            className="w-36 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <button type="submit" disabled={updateTodo.isPending} className="text-xs text-blue-600 hover:underline disabled:opacity-50">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
        </form>
      </div>
    );
  }

  return (
    <div className={`py-2 ${rowBg}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-sm">{item.name}</span>
          <span className="ml-2 text-xs text-gray-400">{addedDate}</span>
          {dueLabel && <span className="ml-1 text-xs text-gray-400">· due {dueLabel}</span>}
        </div>
        <span className="text-xs text-gray-300 shrink-0">todo</span>
        <ConvertTodoToTask todoId={item.id} />
        <button
          onClick={() => {
            setEditName(item.name);
            setEditPts(String(item.point_value));
            setEditDue(item.due_date ?? '');
            setEditing(true);
          }}
          className="shrink-0 text-gray-300 hover:text-blue-500 text-sm"
          title="Edit todo"
        >✎</button>
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
