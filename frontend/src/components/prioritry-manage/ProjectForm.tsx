import { useState } from 'react';
import { useCreateProject } from '../../hooks/useProjects';

export function ProjectForm() {
  const [name, setName] = useState('');
  const [pointValue, setPointValue] = useState('40');
  const [dueDate, setDueDate] = useState('');
  const [overview, setOverview] = useState('');
  const [error, setError] = useState('');

  const createProject = useCreateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseInt(pointValue);
    if (isNaN(parsed) || parsed < 40) {
      setError('Point value must be at least 40');
      return;
    }
    if (!dueDate) {
      setError('Due date is required');
      return;
    }

    try {
      await createProject.mutateAsync({
        name,
        point_value: parsed,
        due_date: dueDate,
        overview: overview || undefined,
      });
      setName('');
      setPointValue('40');
      setDueDate('');
      setOverview('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Add New Project</h3>
      {error && <p className="text-red-600 text-xs">{error}</p>}

      <input
        type="text"
        placeholder="Project name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

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
        <label className="text-xs text-gray-500">Overview (optional)</label>
        <textarea
          value={overview}
          onChange={e => setOverview(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          placeholder="Describe the project..."
        />
      </div>

      <button
        type="submit"
        disabled={createProject.isPending}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        Add Project
      </button>
    </form>
  );
}
