import { Link } from 'react-router-dom';
import { useProjects, useDeleteProject } from '../../hooks/useProjects';

export function ProjectList() {
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  if (isLoading) return <p className="text-gray-400 text-sm">Loading...</p>;
  if (!projects?.length) return <p className="text-gray-400 text-sm">No projects yet. Add one above.</p>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {projects.map(p => (
        <div key={p.id} className="flex items-center justify-between px-4 py-2">
          <div className="flex-1 min-w-0">
            <Link to={`/projects/${p.id}`} className="text-sm font-medium hover:underline text-blue-700">
              {p.name}
            </Link>
            <span className="ml-2 text-xs text-gray-400">{p.point_value} pts</span>
            <span className="ml-2 text-xs text-gray-400">due {p.due_date}</span>
            {p.completed_at && (
              <span className="ml-2 text-xs text-green-600">✓ completed</span>
            )}
          </div>
          <button
            onClick={() => deleteProject.mutate(p.id)}
            disabled={deleteProject.isPending}
            className="text-xs text-red-500 hover:underline disabled:opacity-50 shrink-0"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
