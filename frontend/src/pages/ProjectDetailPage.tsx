import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useProject, useUpdateProject, useCompleteProject, useDeleteProject,
  useAddProjectUpdate, useEditProjectUpdate, useDeleteProjectUpdate,
  useCreateProjectTask, useUpdateProjectTask, useCompleteProjectTask, useDeleteProjectTask,
} from '../hooks/useProjects';
import type { ProjectTask } from '../types';
import { Markdown } from '../components/shared/Markdown';
import { TagCommentInput } from '../components/day-tracker/TagCommentInput';
import { DescriptionAndComment } from '../components/shared/DescriptionAndComment';
import { formatDueDate } from '../lib/urgency';
import { ConvertTaskToTodo } from '../components/shared/ConvertTaskToTodo';

function TaskRow({ task, projectId }: { task: ProjectTask; projectId: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(task.name);
  const [pts, setPts] = useState(String(task.point_value));
  const [due, setDue] = useState(task.due_date ?? '');
  const updateTask = useUpdateProjectTask(projectId);
  const completeTask = useCompleteProjectTask(projectId);
  const deleteTask = useDeleteProjectTask(projectId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const pv = pts.trim() !== '' ? parseInt(pts) : 0;
    await updateTask.mutateAsync({ taskId: task.id, data: { name, point_value: isNaN(pv) ? 0 : pv, due_date: due || null } });
    setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 flex-wrap">
        <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus
          className="flex-1 min-w-32 px-2 py-1 text-sm border border-gray-300 rounded" />
        <input type="number" min={0} value={pts} onChange={e => setPts(e.target.value)} placeholder="pts"
          className="w-14 px-2 py-1 text-sm border border-gray-300 rounded" />
        <input type="date" value={due} onChange={e => setDue(e.target.value)}
          className="w-36 px-2 py-1 text-sm border border-gray-300 rounded" />
        <button type="submit" disabled={updateTask.isPending} className="text-xs text-blue-600 hover:underline disabled:opacity-50">Save</button>
        <button type="button" onClick={() => { setName(task.name); setPts(String(task.point_value)); setDue(task.due_date ?? ''); setEditing(false); }}
          className="text-xs text-gray-500 hover:underline">Cancel</button>
      </form>
    );
  }

  return (
    <div className={`px-3 py-2 rounded-lg border text-sm ${task.completed_at ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-2">
      <span className={`flex-1 min-w-0 ${task.completed_at ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.name}</span>
      <span className="text-xs text-gray-500 shrink-0">
        {task.due_date ? `due ${formatDueDate(task.due_date)}` : 'no due date'}
      </span>
      {task.point_value > 0 && <span className="text-xs text-gray-500 font-mono shrink-0">{task.point_value}pts</span>}
      <ConvertTaskToTodo projectId={projectId} taskId={task.id} />
      {!task.completed_at && (
        <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-blue-500 text-sm shrink-0" title="Edit">✎</button>
      )}
      {!task.completed_at && (
        <button onClick={() => completeTask.mutate(task.id)} disabled={completeTask.isPending}
          className="w-7 h-7 flex items-center justify-center bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 disabled:opacity-40 shrink-0"
          title="Mark complete">✓</button>
      )}
      <button onClick={() => deleteTask.mutate(task.id)} disabled={deleteTask.isPending}
        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 shrink-0" title="Delete">✕</button>
      </div>
      <DescriptionAndComment
        description={task.description}
        comment={task.comment}
        onSaveDescription={description => updateTask.mutate({ taskId: task.id, data: { description } })}
        onSaveComment={comment => updateTask.mutate({ taskId: task.id, data: { comment } })}
      />
    </div>
  );
}

type TaskSortField = 'due_date' | 'created_at';

/** Uncompleted first (undated last within them), then completed, most recent first. */
function sortTasks(tasks: ProjectTask[], field: TaskSortField, dir: 'asc' | 'desc'): ProjectTask[] {
  const compare = (a: ProjectTask, b: ProjectTask) => {
    let cmp: number;
    if (field === 'due_date') {
      // Undated tasks sink to the bottom in either direction — they aren't "later",
      // they're just not on the clock.
      if (!a.due_date || !b.due_date) {
        if (a.due_date === b.due_date) cmp = 0;
        else return a.due_date ? -1 : 1;
      } else {
        cmp = a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      }
    } else {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return dir === 'asc' ? cmp : -cmp;
  };

  const uncompleted = tasks.filter(t => t.completed_at === null).sort(compare);
  const completed = tasks
    .filter(t => t.completed_at !== null)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
  return [...uncompleted, ...completed];
}

function TasksSection({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const [sort, setSort] = useState<{ field: TaskSortField; dir: 'asc' | 'desc' }>({ field: 'due_date', dir: 'asc' });
  const [taskName, setTaskName] = useState('');
  const [taskPts, setTaskPts] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const createTask = useCreateProjectTask(projectId);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    const pv = taskPts.trim() !== '' ? parseInt(taskPts) : 0;
    await createTask.mutateAsync({
      name: taskName,
      point_value: isNaN(pv) ? 0 : pv,
      due_date: taskDue || null,
      description: taskDescription.trim() || null,
    });
    setTaskName(''); setTaskPts(''); setTaskDue(''); setTaskDescription('');
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-gray-800">Tasks</h2>
        {(['due_date', 'created_at'] as TaskSortField[]).map(field => (
          <button
            key={field}
            onClick={() => setSort(prev =>
              prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: field === 'created_at' ? 'desc' : 'asc' }
            )}
            className={`text-xs px-1 rounded hover:text-gray-700 ${sort.field === field ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {field === 'due_date' ? 'due' : 'added'} {sort.field !== field ? '↕' : sort.dir === 'asc' ? '↑' : '↓'}
          </button>
        ))}
      </div>
      {tasks.length === 0 && <p className="text-sm text-gray-500 mb-3">No tasks yet.</p>}
      <div className="space-y-1 mb-3">
        {sortTasks(tasks, sort.field, sort.dir).map(t => <TaskRow key={t.id} task={t} projectId={projectId} />)}
      </div>
      <form onSubmit={handleAdd} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Task name"
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            min={0}
            placeholder="pts"
            value={taskPts}
            onChange={e => setTaskPts(e.target.value)}
            className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
          />
          <input
            type="date"
            value={taskDue}
            onChange={e => setTaskDue(e.target.value)}
            className="w-36 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
          />
          <button
            type="submit"
            disabled={createTask.isPending || !taskName.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
          >Add</button>
        </div>
        <TagCommentInput
          value={taskDescription}
          onChange={setTaskDescription}
          placeholder="Description — what to do, or #tag, (optional) — markdown welcome"
          multiline
        />
      </form>
    </div>
  );
}

// Inline edit/delete for a single update entry
function UpdateEntry({
  update,
  projectId,
}: {
  update: { id: string; body: string; created_at: string };
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(update.body);
  const editUpdate = useEditProjectUpdate(projectId);
  const deleteUpdate = useDeleteProjectUpdate(projectId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    await editUpdate.mutateAsync({ updateId: update.id, body });
    setEditing(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  if (editing) {
    return (
      <form onSubmit={handleSave} className="bg-white rounded-lg border border-blue-300 p-3 space-y-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          autoFocus
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={editUpdate.isPending} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
            Save
          </button>
          <button type="button" onClick={() => { setBody(update.body); setEditing(false); }} className="text-xs text-gray-500 hover:underline">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 group">
      <Markdown
        size="sm"
        className="text-gray-800"
        onToggleTask={body => editUpdate.mutate({ updateId: update.id, body })}
      >
        {update.body}
      </Markdown>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-500">{formatDate(update.created_at)}</p>
        <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:underline">
            Edit
          </button>
          <button
            onClick={() => deleteUpdate.mutate(update.id)}
            disabled={deleteUpdate.isPending}
            className="text-xs text-red-500 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id!);
  const updateProject = useUpdateProject();
  const completeProject = useCompleteProject();
  const deleteProject = useDeleteProject();
  const addUpdate = useAddProjectUpdate(id!);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [pointValue, setPointValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [overview, setOverview] = useState('');
  const [saveError, setSaveError] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setPointValue(project.point_value != null ? String(project.point_value) : '');
      setDueDate(project.due_date ?? '');
      setOverview(project.overview ?? '');
    }
  }, [project]);

  if (isLoading) return <p className="text-gray-500 text-sm text-center py-8">Loading...</p>;
  if (!project) return <p className="text-red-600 text-sm text-center py-8">Project not found.</p>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    let parsedPv: number | null = null;
    if (pointValue.trim() !== '') {
      parsedPv = parseInt(pointValue);
      if (isNaN(parsedPv) || parsedPv < 0) {
        setSaveError('Point value must be 0 or greater');
        return;
      }
    }
    try {
      await updateProject.mutateAsync({
        id: id!,
        data: { name, point_value: parsedPv, due_date: dueDate || null, overview: overview || undefined },
      });
      setEditing(false);
    } catch (err: any) {
      setSaveError(err.message);
    }
  };

  // Auto-save when a checkbox is toggled in the overview
  const handleCheckboxToggle = async (newText: string) => {
    setOverview(newText);
    await updateProject.mutateAsync({
      id: id!,
      data: { overview: newText },
    });
  };

  const handleCancelEdit = () => {
    setName(project.name);
    setPointValue(project.point_value != null ? String(project.point_value) : '');
    setDueDate(project.due_date ?? '');
    setOverview(project.overview ?? '');
    setSaveError('');
    setEditing(false);
  };

  const handleComplete = async () => {
    await completeProject.mutateAsync(id!);
    navigate('/manage-projects');
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync(id!);
    navigate('/manage-projects');
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError('');
    if (!updateBody.trim()) return;
    try {
      await addUpdate.mutateAsync({ body: updateBody });
      setUpdateBody('');
    } catch (err: any) {
      setUpdateError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <button onClick={() => navigate('/manage-projects')} className="text-sm text-blue-600 hover:underline mb-4 block">
          ← Back to Projects
        </button>

        {editing ? (
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h2 className="text-lg font-bold text-gray-800">Edit Project</h2>
            {saveError && <p className="text-red-600 text-xs">{saveError}</p>}

            <div>
              <label className="text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Point Value <span className="text-gray-500">(optional)</span></label>
                <input
                  type="number"
                  min={0}
                  value={pointValue}
                  onChange={e => setPointValue(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Due Date <span className="text-gray-500">(optional)</span></label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Overview — markdown: <code className="bg-gray-100 px-1 rounded">- [ ] item</code> for checkboxes,{' '}
                <code className="bg-gray-100 px-1 rounded">- item</code> for bullets,{' '}
                <code className="bg-gray-100 px-1 rounded">~~text~~</code> for strikethrough, links autolink
              </label>
              <textarea
                value={overview}
                onChange={e => setOverview(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                placeholder="- [ ] Task one&#10;- [ ] Task two&#10;~~done thing~~"
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={updateProject.isPending} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-800">{project.name}</h2>
              <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:underline shrink-0">
                Edit
              </button>
            </div>

            <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
              {project.point_value != null
                ? <span>{project.point_value} pts</span>
                : <span className="text-gray-500 italic">no point value</span>
              }
              {project.due_date
                ? <span>due {project.due_date}</span>
                : <span className="text-gray-500 italic">rolling (no due date)</span>
              }
              {project.completed_at && <span className="text-green-600">✓ completed</span>}
            </div>

            {project.overview ? (
              <Markdown size="sm" className="text-gray-700" onToggleTask={handleCheckboxToggle}>
                {project.overview}
              </Markdown>
            ) : (
              <p className="text-sm text-gray-500 italic">No overview yet. Click Edit to add one.</p>
            )}

            <div className="flex gap-2 pt-1 flex-wrap">
              {!project.completed_at && (
                <button onClick={handleComplete} disabled={completeProject.isPending} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                  Mark Complete
                </button>
              )}
              <button onClick={handleDelete} disabled={deleteProject.isPending} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <TasksSection projectId={id!} tasks={project.tasks} />

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Updates</h2>

        {project.updates.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">No updates yet.</p>
        )}

        <div className="space-y-3 mb-4">
          {project.updates.map(u => (
            <UpdateEntry key={u.id} update={u} projectId={id!} />
          ))}
        </div>

        <form onSubmit={handleAddUpdate} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          {updateError && <p className="text-red-600 text-xs">{updateError}</p>}
          <textarea
            value={updateBody}
            onChange={e => setUpdateBody(e.target.value)}
            rows={3}
            placeholder="Add an update..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={addUpdate.isPending || !updateBody.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Add Update
          </button>
        </form>
      </div>
    </div>
  );
}
