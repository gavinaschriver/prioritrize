import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useUpdateProject, useCompleteProject, useDeleteProject, useAddProjectUpdate } from '../hooks/useProjects';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id!);
  const updateProject = useUpdateProject();
  const completeProject = useCompleteProject();
  const deleteProject = useDeleteProject();
  const addUpdate = useAddProjectUpdate(id!);

  const [name, setName] = useState('');
  const [pointValue, setPointValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [overview, setOverview] = useState('');
  const [editInitialized, setEditInitialized] = useState(false);
  const [updateBody, setUpdateBody] = useState('');
  const [saveError, setSaveError] = useState('');
  const [updateError, setUpdateError] = useState('');

  if (isLoading) return <p className="text-gray-400 text-sm text-center py-8">Loading...</p>;
  if (!project) return <p className="text-red-600 text-sm text-center py-8">Project not found.</p>;

  // Initialize edit fields from loaded data (once)
  if (!editInitialized && project) {
    setName(project.name);
    setPointValue(String(project.point_value));
    setDueDate(project.due_date);
    setOverview(project.overview ?? '');
    setEditInitialized(true);
  }

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
    } catch (err: any) {
      setSaveError(err.message);
    }
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-8">
      <div>
        <button onClick={() => navigate('/manage-projects')} className="text-sm text-blue-600 hover:underline mb-4 block">
          ← Back to Projects
        </button>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Project Overview</h2>

        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          {saveError && <p className="text-red-600 text-xs">{saveError}</p>}

          <div>
            <label className="text-xs text-gray-500">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
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
            <label className="text-xs text-gray-500">Overview</label>
            <textarea
              value={overview}
              onChange={e => setOverview(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="Describe the project..."
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="submit"
              disabled={updateProject.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            {!project.completed_at && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={completeProject.isPending}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Mark Complete
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Updates</h2>

        {project.updates.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">No updates yet.</p>
        )}

        <div className="space-y-3 mb-4">
          {project.updates.map(u => (
            <div key={u.id} className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{u.body}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(u.created_at)}</p>
            </div>
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
