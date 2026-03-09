import { Link } from 'react-router-dom';
import { useCompleteProject } from '../../hooks/useProjects';
import type { ProjectSummary } from '../../types';

interface ProjectRowProps {
  item: ProjectSummary;
}

export function ProjectRow({ item }: ProjectRowProps) {
  const completeProject = useCompleteProject();
  const score = Number(item.score);
  const isCompleted = item.completed_at !== null;
  const isUpcoming = item.is_upcoming;

  const scoreDisplay = isUpcoming ? '—' : (score > 0 ? `+${score}` : String(score));
  const scoreColor = isUpcoming ? 'text-gray-400' : score > 0 ? 'text-green-600' : 'text-red-600';

  const rowBg = isUpcoming
    ? 'border-b border-gray-100 py-2'
    : 'bg-red-50 border border-red-200 rounded-lg px-2 -mx-2 py-2';

  return (
    <div className={rowBg}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Link
            to={`/projects/${item.id}`}
            className={`text-sm hover:underline ${isUpcoming ? 'text-gray-500' : 'text-gray-900'}`}
          >
            {item.name}
          </Link>
          <span className="ml-2 text-xs text-gray-400">{item.due_date}</span>
        </div>
        <button
          onClick={() => completeProject.mutate(item.id)}
          disabled={isUpcoming || isCompleted || completeProject.isPending}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title={isUpcoming ? 'Not yet due' : isCompleted ? 'Completed' : 'Mark complete'}
        >
          ✓
        </button>
        <span className="w-12 text-right text-sm font-mono">{item.point_value}</span>
        <span className={`w-14 text-right text-sm font-mono font-bold ${scoreColor}`}>
          {scoreDisplay}
        </span>
      </div>
    </div>
  );
}
