import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompleteProject, useCompleteProjectTask, useUpdateProjectTask } from '../../hooks/useProjects';
import type { DeadlineSummary } from '../../types';

function urgencyRowClass(createdAt: string, dueDate: string, isCompleted: boolean, isUpcoming: boolean): string {
  const base = 'rounded-lg px-2 -mx-2 py-2';
  if (isCompleted) return `bg-green-50 border border-green-200 ${base}`;
  if (!isUpcoming) return `bg-red-50 border border-red-200 ${base}`;

  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const due = new Date(dueDate + 'T23:59:59').getTime();
  const total = due - created;
  const pct = total > 0 ? (now - created) / total : 1;

  if (pct >= 0.75) return `bg-orange-50 border border-orange-200 ${base}`;
  if (pct >= 0.5) return `bg-yellow-50 border border-yellow-200 ${base}`;
  return 'border-b border-gray-100 py-2';
}

interface DeadlineRowProps {
  item: DeadlineSummary;
}

export function DeadlineRow({ item }: DeadlineRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPts, setEditPts] = useState(item.point_value != null ? String(item.point_value) : '');
  const [editDue, setEditDue] = useState(item.due_date);

  const completeProject = useCompleteProject();
  const completeTask = useCompleteProjectTask(item.project_id ?? item.id);
  const updateTask = useUpdateProjectTask(item.project_id ?? item.id);

  const score = Number(item.score);
  const isCompleted = item.completed_at !== null;
  const isUpcoming = item.is_upcoming;

  const scoreDisplay = isUpcoming && !isCompleted ? '—' : score > 0 ? `+${score}` : String(score);
  const scoreColor = isUpcoming && !isCompleted ? 'text-gray-400' : score > 0 ? 'text-green-600' : 'text-red-600';
  const rowBg = urgencyRowClass(item.created_at, item.due_date, isCompleted, isUpcoming);

  const handleComplete = () => {
    if (item.type === 'project') {
      completeProject.mutate(item.id);
    } else {
      completeTask.mutate(item.id);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pv = editPts.trim() !== '' ? parseInt(editPts) : 0;
    await updateTask.mutateAsync({
      taskId: item.id,
      data: { name: editName, point_value: isNaN(pv) ? 0 : pv, due_date: editDue || null },
    });
    setEditing(false);
  };

  const isPending = completeProject.isPending || completeTask.isPending;
  const detailLink = item.type === 'project' ? `/projects/${item.id}` : `/projects/${item.project_id}`;

  if (editing && item.type === 'task') {
    return (
      <div className={rowBg}>
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
          <button type="submit" disabled={updateTask.isPending} className="text-xs text-blue-600 hover:underline disabled:opacity-50">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
        </form>
      </div>
    );
  }

  return (
    <div className={rowBg}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Link to={detailLink} className="text-sm hover:underline text-gray-900">
            {item.name}
          </Link>
          {item.type === 'task' && item.project_name && (
            <span className="ml-1 text-xs text-gray-400">· {item.project_name}</span>
          )}
          <span className="ml-2 text-xs text-gray-400">{item.due_date}</span>
        </div>
        <span className="text-xs text-gray-300 shrink-0">{item.type === 'task' ? 'task' : 'proj'}</span>
        {item.type === 'task' && !isCompleted && (
          <button
            onClick={() => {
              setEditName(item.name);
              setEditPts(item.point_value != null ? String(item.point_value) : '');
              setEditDue(item.due_date);
              setEditing(true);
            }}
            className="shrink-0 text-gray-300 hover:text-blue-500 text-sm"
            title="Edit task"
          >✎</button>
        )}
        <button
          onClick={handleComplete}
          disabled={isCompleted || isPending}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title={isCompleted ? 'Completed' : 'Mark complete'}
        >✓</button>
        <span className="w-12 text-right text-sm font-mono">{item.point_value != null ? item.point_value : '—'}</span>
        <span className={`w-14 text-right text-sm font-mono font-bold ${scoreColor}`}>{scoreDisplay}</span>
      </div>
    </div>
  );
}
