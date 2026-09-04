import { useState } from 'react';
import { useDeleteEntry, useUpdateEntryComment, useDecrementEntry, useIncrementEntry } from '../../hooks/useEntries';
import { useUncompleteTodo } from '../../hooks/useTodos';
import { useUncompleteProjectTask, useUncompleteProject } from '../../hooks/useProjects';
import { EditableComment } from './EditableComment';
import { TodoDetailModal } from '../shared/TodoDetailModal';
import { TaskDetailModal } from '../shared/TaskDetailModal';
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
  onOpen,
  onRemove,
  onDecrement,
  onIncrement,
  removeLabel = 'Remove',
  removeDisabled,
}: {
  title: string;
  kind?: React.ReactNode;
  points?: number;
  comment: string | null;
  onSaveComment?: (comment: string | null) => void;
  /** Given, the row body opens the item's detail sheet. */
  onOpen?: () => void;
  onRemove: () => void;
  onDecrement?: () => void;
  onIncrement?: () => void;
  removeLabel?: string;
  removeDisabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
      <div
        className={`flex-1 min-w-0 ${onOpen ? 'cursor-pointer' : ''}`}
        onClick={onOpen}
        title={onOpen ? 'Open details' : undefined}
      >
        <p className="text-sm font-medium">
          {title}
          {kind && <span className="ml-2 text-xs text-gray-500 uppercase tracking-wide">{kind}</span>}
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
      {onDecrement && (
        <button
          onClick={onDecrement}
          disabled={removeDisabled}
          title="Remove one block"
          className="shrink-0 ml-2 text-xs text-gray-500 hover:text-gray-600 hover:underline disabled:opacity-50"
        >
          −1
        </button>
      )}
      {onIncrement && (
        <button
          onClick={onIncrement}
          disabled={removeDisabled}
          title="Add one more block"
          className="shrink-0 ml-2 text-xs text-gray-500 hover:text-gray-600 hover:underline disabled:opacity-50"
        >
          +1
        </button>
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
  const [open, setOpen] = useState(false);
  const uncomplete = useUncompleteTodo();
  return (
    <>
      <CompletedRow
        title={item.name}
        kind="todo"
        points={Number(item.score)}
        comment={item.comment}
        onOpen={() => setOpen(true)}
        onRemove={() => uncomplete.mutate(item.id)}
        removeDisabled={uncomplete.isPending}
      />
      {open && <TodoDetailModal todoId={item.id} onClose={() => setOpen(false)} />}
    </>
  );
}

function TaskEntry({ item }: { item: DeadlineSummary }) {
  const [open, setOpen] = useState(false);
  const projectId = item.project_id ?? item.id;
  const uncomplete = useUncompleteProjectTask(projectId);
  return (
    <>
      <CompletedRow
        title={item.name}
        kind={item.project_name ? <>task · <span className="font-bold">{item.project_name}</span></> : 'task'}
        points={Number(item.score)}
        comment={item.comment}
        onOpen={() => setOpen(true)}
        onRemove={() => uncomplete.mutate(item.id)}
        removeDisabled={uncomplete.isPending}
      />
      {open && (
        <TaskDetailModal projectId={projectId} taskId={item.id} onClose={() => setOpen(false)} />
      )}
    </>
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
  const decrementEntry = useDecrementEntry();
  const incrementEntry = useIncrementEntry();
  const updateComment = useUpdateEntryComment();

  const dailyEntries = [
    ...summary.goals.flatMap(g =>
      g.entries.map(e => ({ ...e, prioritryName: g.name, timeblock: g.timeblock, canRepeat: g.can_repeat, commentsEnabled: g.comments_enabled, points: Number(g.point_value) }))
    ),
    ...summary.bonuses.flatMap(b =>
      b.entries.map(e => ({ ...e, prioritryName: b.name, timeblock: b.timeblock, canRepeat: b.can_repeat, commentsEnabled: b.comments_enabled, points: Number(b.point_value) }))
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
    dailyEntries.reduce((sum, e) => sum + e.points * e.quantity, 0);

  const isEmpty = dailyEntries.length === 0 && completedTodos.length === 0 && completedDeadlines.length === 0;
  if (isEmpty) return null;

  const formatName = (name: string, timeblock: number | null, quantity: number) => {
    if (timeblock) {
      const hours = Math.floor(timeblock / 60);
      const mins = timeblock % 60;
      const timeStr = hours > 0
        ? (mins > 0 ? `${hours} hr ${mins} min` : `${hours} hour`)
        : `${mins} min`;
      // One entry can carry several blocks — show the multiplier and the span it adds up to.
      if (quantity > 1) {
        const totalMins = timeblock * quantity;
        const tHours = Math.floor(totalMins / 60);
        const tMins = totalMins % 60;
        const totalStr = tHours > 0
          ? (tMins > 0 ? `${tHours} hr ${tMins} min` : `${tHours} hr`)
          : `${tMins} min`;
        return `${name} ${quantity} × ${timeStr} (${totalStr})`;
      }
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
            title={formatName(entry.prioritryName, entry.timeblock, entry.quantity)}
            kind="daily"
            points={entry.points * entry.quantity}
            comment={entry.comment}
            onSaveComment={
              entry.commentsEnabled
                ? comment => updateComment.mutate({ entryId: entry.id, comment })
                : undefined
            }
            onRemove={() => deleteEntry.mutate(entry.id)}
            onDecrement={
              entry.quantity > 1 ? () => decrementEntry.mutate(entry.id) : undefined
            }
            // Same rule as the row stepper: blocks only stack on repeatable timed items.
            onIncrement={
              entry.timeblock !== null && entry.canRepeat
                ? () => incrementEntry.mutate(entry.id)
                : undefined
            }
            removeDisabled={
              deleteEntry.isPending || decrementEntry.isPending || incrementEntry.isPending
            }
          />
        ))}
      </div>
    </div>
  );
}
