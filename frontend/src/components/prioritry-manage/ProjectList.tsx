import { Link } from 'react-router-dom';
import { useProjects, useDeleteProject, useReorderProjects } from '../../hooks/useProjects';
import { useSortableList } from '../../hooks/useSortableList';

export function ProjectList() {
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();
  const reorderProjects = useReorderProjects();

  const ids = projects?.map(p => p.id) ?? [];
  // mutateAsync so the drop can keep showing its order until the write settles.
  const { items, dragId, registerRow, dragHandleProps } = useSortableList(
    ids,
    reorderProjects.mutateAsync,
  );

  if (isLoading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (!projects?.length) return <p className="text-gray-500 text-sm">No projects yet. Add one above.</p>;

  const byId = new Map(projects.map(p => [p.id, p]));

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {items.map(id => {
        const p = byId.get(id);
        if (!p) return null;
        return (
          <div
            key={p.id}
            ref={registerRow(p.id)}
            className={`flex items-center gap-2 px-2 sm:px-4 py-2 ${
              dragId === p.id ? 'bg-blue-50 ring-1 ring-blue-300 rounded' : ''
            }`}
          >
            <span
              {...dragHandleProps(p.id)}
              title="Drag to reorder"
              aria-label="Drag to reorder"
              className="shrink-0 select-none px-1 text-gray-500 hover:text-gray-500 cursor-grab active:cursor-grabbing text-sm leading-none"
            >
              ⠿
            </span>
            <div className="flex-1 min-w-0">
              <Link to={`/projects/${p.id}`} className="text-sm font-medium hover:underline text-blue-700">
                {p.name}
              </Link>
              {p.point_value != null && (
                <span className="ml-2 text-xs text-gray-500">{p.point_value} pts</span>
              )}
              {p.due_date
                ? <span className="ml-2 text-xs text-gray-500">due {p.due_date}</span>
                : <span className="ml-2 text-xs text-gray-500 italic">rolling</span>
              }
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
        );
      })}
    </div>
  );
}
