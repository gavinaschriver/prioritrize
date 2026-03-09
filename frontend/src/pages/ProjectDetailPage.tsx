import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useProject, useUpdateProject, useCompleteProject, useDeleteProject,
  useAddProjectUpdate, useEditProjectUpdate, useDeleteProjectUpdate,
} from '../hooks/useProjects';
import { MarkdownRenderer } from '../components/shared/MarkdownRenderer';

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
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{update.body}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-400">{formatDate(update.created_at)}</p>
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
      setPointValue(String(project.point_value));
      setDueDate(project.due_date);
      setOverview(project.overview ?? '');
    }
  }, [project]);

  if (isLoading) return <p className="text-gray-400 text-sm text-center py-8">Loading...</p>;
  if (!project) return <p className="text-red-600 text-sm text-center py-8">Project not found.</p>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    const parsed = parseInt(pointValue);
    if (isNaN(parsed) || parsed < 40) {
      setSaveError('Point value must be at least 40');
      return;
    }
    try {
      await updateProject.mutateAsync({
        id: id!,
        data: { name, point_value: parsed, due_date: dueDate, overview: overview || undefined },
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
    setPointValue(String(project.point_value));
    setDueDate(project.due_date);
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
                <label className="text-xs text-gray-500">Point Value (min 40)</label>
                <input
                  type="number"
                  min={40}
                  value={pointValue}
                  onChange={e => setPointValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                Overview — use <code className="bg-gray-100 px-1 rounded">[ ] item</code> for checkboxes, <code className="bg-gray-100 px-1 rounded">~~text~~</code> for strikethrough
              </label>
              <textarea
                value={overview}
                onChange={e => setOverview(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                placeholder="[ ] Task one&#10;[ ] Task two&#10;~~done thing~~"
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

            <div className="flex gap-4 text-sm text-gray-500">
              <span>{project.point_value} pts</span>
              <span>due {project.due_date}</span>
              {project.completed_at && <span className="text-green-600">✓ completed</span>}
            </div>

            {project.overview ? (
              <MarkdownRenderer text={project.overview} onCheckboxToggle={handleCheckboxToggle} className="space-y-1" />
            ) : (
              <p className="text-sm text-gray-400 italic">No overview yet. Click Edit to add one.</p>
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

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Updates</h2>

        {project.updates.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">No updates yet.</p>
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
