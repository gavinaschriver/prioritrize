import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompleteProject, useCompleteProjectTask, useUpdateProjectTask } from '../../hooks/useProjects';
import { urgencyRowClass, formatDueDate } from '../../lib/urgency';
import { EditableComment } from './EditableComment';
import { ConvertTaskToTodo } from '../shared/ConvertTaskToTodo';
import type { DeadlineSummary } from '../../types';

interface DeadlineRowProps {
  item: DeadlineSummary;
  viewedDate: string;
}

export function DeadlineRow({ item, viewedDate }: DeadlineRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPts, setEditPts] = useState(item.point_value != null ? String(item.point_value) : '');
  const [editDue, setEditDue] = useState(item.due_date ?? '');

  const completeProject = useCompleteProject();
  const completeTask = useCompleteProjectTask(item.project_id ?? item.id);
  const updateTask = useUpdateProjectTask(item.project_id ?? item.id);

  const score = Number(item.score);
  // Nothing is riding on it yet — no due date, or the due date hasn't arrived
  const scoreDisplay = item.is_upcoming ? '—' : score > 0 ? `+${score}` : String(score);
  const scoreColor = item.is_upcoming ? 'text-gray-400' : score > 0 ? 'text-green-600' : 'text-red-600';
  const rowBg = urgencyRowClass(item.due_date, viewedDate);

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
          <button type="submit" disabled={updateTask.isPending} className="text-xs text-blue-600 hover:underline disabled:opacity-50">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
        </form>
      </div>
    );
  }

  return (
    <div className={`py-2 ${rowBg}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Link to={detailLink} className="text-sm hover:underline text-gray-900">
            {item.name}
          </Link>
          {item.type === 'task' && item.project_name && (
            <span className="ml-1 text-xs text-gray-400">· {item.project_name}</span>
          )}
          <span className="ml-2 text-xs text-gray-400">
            {item.due_date ? `due ${formatDueDate(item.due_date)}` : 'no due date'}
          </span>
        </div>
        <span className="text-xs text-gray-300 shrink-0">{item.type === 'task' ? 'task' : 'proj'}</span>
        {item.type === 'task' && item.project_id && (
          <ConvertTaskToTodo projectId={item.project_id} taskId={item.id} />
        )}
        {item.type === 'task' && (
          <button
            onClick={() => {
              setEditName(item.name);
              setEditPts(item.point_value != null ? String(item.point_value) : '');
              setEditDue(item.due_date ?? '');
              setEditing(true);
            }}
            className="shrink-0 text-gray-300 hover:text-blue-500 text-sm"
            title="Edit task"
          >✎</button>
        )}
        <button
          onClick={handleComplete}
          disabled={isPending}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Mark complete"
        >✓</button>
        <span className="w-12 text-right text-sm font-mono">{item.point_value != null ? item.point_value : '—'}</span>
        <span className={`w-14 text-right text-sm font-mono font-bold ${scoreColor}`}>{scoreDisplay}</span>
      </div>
      {item.type === 'task' && (
        <EditableComment
          value={item.comment}
          onSave={comment => updateTask.mutate({ taskId: item.id, data: { comment } })}
        />
      )}
    </div>
  );
}
