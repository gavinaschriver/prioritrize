import { useState } from 'react';
import { ProjectRow } from './ProjectRow';
import type { ProjectSummary } from '../../types';

interface ProjectsSectionProps {
  projects: ProjectSummary[];
  subtotal: number;
}

export function ProjectsSection({ projects, subtotal }: ProjectsSectionProps) {
  const [open, setOpen] = useState(true);

  const upcoming = projects.filter(p => p.is_upcoming);
  const active = projects.filter(p => !p.is_upcoming);

  const subtotalColor = subtotal >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>Projects</span>
        </button>
        <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
          {subtotal >= 0 ? '+' : ''}{subtotal % 1 === 0 ? subtotal : Number(subtotal).toFixed(1)}
        </span>
      </div>
      {open && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-0 mb-1">
            <div className="flex-1">Name</div>
            <div className="w-8"></div>
            <div className="w-12 text-right">Pts</div>
            <div className="w-14 text-right">Score</div>
          </div>

          {active.length === 0 && upcoming.length === 0 && (
            <p className="text-sm text-gray-400 py-2">No active projects.</p>
          )}

          {active.map(p => (
            <ProjectRow key={p.id} item={p} />
          ))}

          {upcoming.length > 0 && (
            <>
              {active.length > 0 && <div className="mt-2" />}
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Upcoming</p>
              {upcoming.map(p => (
                <ProjectRow key={p.id} item={p} />
              ))}
            </>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-200 mt-1">
            <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
              {subtotal >= 0 ? '+' : ''}{subtotal % 1 === 0 ? subtotal : Number(subtotal).toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
