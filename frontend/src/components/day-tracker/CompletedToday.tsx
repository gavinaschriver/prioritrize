import { useDeleteEntry, useUpdateEntryComment } from '../../hooks/useEntries';
import { useUncompleteTodo, useUpdateTodo } from '../../hooks/useTodos';
import { useUncompleteProjectTask, useUpdateProjectTask, useUncompleteProject } from '../../hooks/useProjects';
import { EditableComment } from './EditableComment';
import { formatScore } from './SectionSubtotal';
import type { DaySummary, DeadlineSummary, TodoSummary } from '../../types';

interface CompletedTodayProps {
  summary: DaySummary;
}

/** Shared shell so every completed thing — daily entry, todo, task — reads the same. */
function CompletedRow({
  title,
  kind,
  points,
  comment,
  onSaveComment,
  onRemove,
  removeLabel = 'Remove',
  removeDisabled,
}: {
  title: string;
  kind?: string;
  points?: number;
  comment: string | null;
  onSaveComment?: (comment: string | null) => void;
  onRemove: () => void;
  removeLabel?: string;
  removeDisabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {title}
          {kind && <span className="ml-2 text-xs text-gray-300 uppercase tracking-wide">{kind}</span>}
        </p>
        {onSaveComment ? (
          <EditableComment value={comment} onSave={onSaveComment} />
        ) : comment ? (
          <p className="text-xs text-gray-500 italic mt-0.5">{comment}</p>
        ) : null}
      </div>
      {points != null && (
        <span className="shrink-0 ml-2 text-sm font-mono font-bold text-green-600">
          {points > 0 ? `+${points}` : points}
        </span>
      )}
      <button
        onClick={onRemove}
        disabled={removeDisabled}
        className="shrink-0 ml-2 text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
      >
        {removeLabel}
      </button>
    </div>
  );
}

function TodoEntry({ item }: { item: TodoSummary }) {
  const uncomplete = useUncompleteTodo();
  const updateTodo = useUpdateTodo();
  return (
    <CompletedRow
      title={item.name}
      kind="todo"
      points={Number(item.score)}
      comment={item.comment}
      onSaveComment={comment => updateTodo.mutate({ id: item.id, data: { comment } })}
      onRemove={() => uncomplete.mutate(item.id)}
      removeDisabled={uncomplete.isPending}
    />
  );
}

function TaskEntry({ item }: { item: DeadlineSummary }) {
  const projectId = item.project_id ?? item.id;
  const uncomplete = useUncompleteProjectTask(projectId);
  const updateTask = useUpdateProjectTask(projectId);
  return (
    <CompletedRow
      title={item.name}
      kind={item.project_name ? `task · ${item.project_name}` : 'task'}
      points={Number(item.score)}
      comment={item.comment}
      onSaveComment={comment => updateTask.mutate({ taskId: item.id, data: { comment } })}
      onRemove={() => uncomplete.mutate(item.id)}
      removeDisabled={uncomplete.isPending}
    />
  );
}

function ProjectEntry({ item }: { item: DeadlineSummary }) {
  const uncomplete = useUncompleteProject();
  return (
    <CompletedRow
      title={item.name}
      kind="project"
      points={Number(item.score)}
      comment={null}
      onRemove={() => uncomplete.mutate(item.id)}
      removeDisabled={uncomplete.isPending}
    />
  );
}

export function CompletedToday({ summary }: CompletedTodayProps) {
  const deleteEntry = useDeleteEntry();
  const updateComment = useUpdateEntryComment();

  const dailyEntries = [
    ...summary.goals.flatMap(g =>
      g.entries.map(e => ({ ...e, prioritryName: g.name, timeblock: g.timeblock, commentsEnabled: g.comments_enabled, points: Number(g.point_value) }))
    ),
    ...summary.bonuses.flatMap(b =>
      b.entries.map(e => ({ ...e, prioritryName: b.name, timeblock: b.timeblock, commentsEnabled: b.comments_enabled, points: Number(b.point_value) }))
    ),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const completedTodos = summary.todos.filter(t => t.completed_at !== null);
  const completedDeadlines = summary.deadlines.filter(d => d.completed_at !== null);

  // Everything logged here earns its points on this day, so the header is the sum of
  // the rows below it. Daily entries also count inside their own section's subtotal —
  // this is a log of the day, not a fifth section to add up.
  const total =
    completedTodos.reduce((sum, t) => sum + Number(t.score), 0) +
    completedDeadlines.reduce((sum, d) => sum + Number(d.score), 0) +
    dailyEntries.reduce((sum, e) => sum + e.points, 0);

  const isEmpty = dailyEntries.length === 0 && completedTodos.length === 0 && completedDeadlines.length === 0;
  if (isEmpty) return null;

  const formatName = (name: string, timeblock: number | null) => {
    if (timeblock) {
      const hours = Math.floor(timeblock / 60);
      const mins = timeblock % 60;
      const timeStr = hours > 0
        ? (mins > 0 ? `${hours} hr ${mins} min` : `${hours} hour`)
        : `${mins} min`;
      return `${name} ${timeStr}`;
    }
    return name;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Completed Today
        </h3>
        <span className={`text-sm font-bold font-mono ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatScore(total)}
        </span>
      </div>
      <div className="space-y-2">
        {completedTodos.map(t => <TodoEntry key={`todo-${t.id}`} item={t} />)}
        {completedDeadlines.map(d =>
          d.type === 'task'
            ? <TaskEntry key={`task-${d.id}`} item={d} />
            : <ProjectEntry key={`project-${d.id}`} item={d} />
        )}
        {dailyEntries.map(entry => (
          <CompletedRow
            key={entry.id}
            title={formatName(entry.prioritryName, entry.timeblock)}
            kind="daily"
            points={entry.points}
            comment={entry.comment}
            onSaveComment={
              entry.commentsEnabled
                ? comment => updateComment.mutate({ entryId: entry.id, comment })
                : undefined
            }
            onRemove={() => deleteEntry.mutate(entry.id)}
            removeDisabled={deleteEntry.isPending}
          />
        ))}
      </div>
    </div>
  );
}
