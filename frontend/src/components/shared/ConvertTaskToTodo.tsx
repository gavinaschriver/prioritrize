import { useConvertTaskToTodo } from '../../hooks/useProjects';

interface ConvertTaskToTodoProps {
  projectId: string;
  taskId: string;
}

/** Detaches a task from its project. Everything but the project link survives. */
export function ConvertTaskToTodo({ projectId, taskId }: ConvertTaskToTodoProps) {
  const convert = useConvertTaskToTodo(projectId);

  return (
    <button
      onClick={e => { e.stopPropagation(); convert.mutate(taskId); }}
      disabled={convert.isPending}
      className="shrink-0 text-xs text-gray-500 hover:text-blue-500 disabled:opacity-50"
      title="Detach from its project and keep it as a standalone todo"
    >
      convert to todo
    </button>
  );
}
