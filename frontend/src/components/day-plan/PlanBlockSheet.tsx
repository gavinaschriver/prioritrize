import { TodoDetailModal } from '../shared/TodoDetailModal';
import { TaskDetailModal } from '../shared/TaskDetailModal';
import { DailyDetailModal } from '../shared/DailyDetailModal';
import { useDaySummary } from '../../hooks/useDaySummary';
import type { PlanBlock } from '../../types';

interface PlanBlockSheetProps {
  block: PlanBlock | null;
  viewedDate: string;
  onClose: () => void;
}

/** The same detail sheet the tracker opens, picked by what the block points at. */
export function PlanBlockSheet({ block, viewedDate, onClose }: PlanBlockSheetProps) {
  if (!block?.entity_id) return null;

  switch (block.entity_type) {
    case 'todo':
      return <TodoDetailModal todoId={block.entity_id} onClose={onClose} viewedDate={viewedDate} />;
    case 'project_task':
      return block.project_id ? (
        <TaskDetailModal projectId={block.project_id} taskId={block.entity_id} onClose={onClose} viewedDate={viewedDate} />
      ) : null;
    case 'prioritry':
      // Keyed per block so the comment box re-seeds from each session's own note.
      return (
        <DailySheet
          key={block.id ?? block.entity_id}
          prioritryId={block.entity_id}
          note={block.note}
          viewedDate={viewedDate}
          onClose={onClose}
        />
      );
    default:
      return null;
  }
}

/** The daily sheet wants the day's summary row (entries, counts), not the bare
 *  daily -- so it fetches the tracker's summary for the day and finds it there.
 *  Its own component so that fetch only happens while a daily is open. */
function DailySheet({ prioritryId, note, viewedDate, onClose }: {
  prioritryId: string;
  note: string | null;
  viewedDate: string;
  onClose: () => void;
}) {
  const { data: summary } = useDaySummary(viewedDate);
  if (!summary) return null;

  const goal = summary.goals.find(g => g.prioritry_id === prioritryId);
  const bonus = summary.bonuses.find(b => b.prioritry_id === prioritryId);
  const item = goal ?? bonus ?? null;

  return (
    <DailyDetailModal
      item={item}
      isBonus={!goal}
      selectedDate={viewedDate}
      onClose={onClose}
      initialComment={note ?? undefined}
    />
  );
}
