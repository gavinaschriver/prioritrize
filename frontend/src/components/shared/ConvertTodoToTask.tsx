import { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { useConvertTodoToTask } from '../../hooks/useTodos';

interface ConvertTodoToTaskProps {
  todoId: string;
}

/** Turns a standalone todo into a task under a project. Shown wherever todos are listed. */
export function ConvertTodoToTask({ todoId }: ConvertTodoToTaskProps) {
  const [picking, setPicking] = useState(false);
  const { data: projects } = useProjects();
  const convert = useConvertTodoToTask();

  if (!picking) {
    return (
      <button
        onClick={e => { e.stopPropagation(); setPicking(true); }}
        disabled={convert.isPending}
        className="shrink-0 text-xs text-gray-500 hover:text-blue-500 disabled:opacity-50"
        title="Move this todo into a project"
      >
        convert to task
      </button>
    );
  }

  return (
    <select
      autoFocus
      defaultValue=""
      onClick={e => e.stopPropagation()}
      onChange={e => {
        const projectId = e.target.value;
        if (projectId) convert.mutate({ todoId, projectId });
        setPicking(false);
      }}
      onBlur={() => setPicking(false)}
      className="shrink-0 max-w-40 text-xs border border-gray-300 rounded px-1 py-0.5"
    >
      <option value="" disabled>{projects?.length ? 'Pick a project...' : 'No projects yet'}</option>
      {projects?.map(project => (
        <option key={project.id} value={project.id}>{project.name}</option>
      ))}
    </select>
  );
}
