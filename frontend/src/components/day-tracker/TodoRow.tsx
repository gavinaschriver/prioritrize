import { useState } from "react";
import { useCompleteTodo } from "../../hooks/useTodos";
import { urgencyRow, formatDueDate } from "../../lib/urgency";
import { TodoDetailModal } from "../shared/TodoDetailModal";
import { DeferredBadge } from "../shared/DeferredBadge";
import { DueBadge } from "../shared/DueBadge";
import { CategoryChip } from "../shared/CategorySelect";
import { ActivateButton } from "../shared/ActivateButton";
import type { TodoSummary } from "../../types";

interface TodoRowProps {
  item: TodoSummary;
  viewedDate: string;
}

export function TodoRow({ item, viewedDate }: TodoRowProps) {
  // Everything about the todo -- description, comments, files, editing,
  // converting -- now lives in the detail sheet this opens.
  const [open, setOpen] = useState(false);
  const completeTodo = useCompleteTodo();

  const score = Number(item.score);
  // Nothing is riding on it yet — no due date, or the due date hasn't arrived
  const scoreDisplay = item.is_upcoming
    ? "—"
    : score > 0
      ? `+${score}`
      : String(score);
  const scoreColor = item.is_upcoming
    ? "text-gray-500"
    : score > 0
      ? "text-green-600"
      : "text-red-600";
  // Coloured by the date this day is actually scored against, which is the item's
  // own due date except on days a deferral pushed out from under. Those days keep
  // the urgency they really had, so the row can't sit calm and green while docking.
  const row = urgencyRow(item.effective_due_date, viewedDate);

  const dueLabel = item.due_date ? formatDueDate(item.due_date) : null;

  return (
    <>
      <div
        className={`py-2 cursor-pointer ${row.className}`}
        style={row.style}
        onClick={() => setOpen(true)}
        title="Open details"
      >
        <div className="flex items-start gap-1 sm:gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-sm wrap-break-word">{item.name}</span>
            <CategoryChip categoryId={item.category_id} className="ml-2" />
            {item.deferred && (
              <DeferredBadge effectiveDueDate={item.effective_due_date} />
            )}
            <DueBadge dueDate={item.effective_due_date} viewedDate={viewedDate} />
            {!item.completed_at && (
              <ActivateButton type="todo" id={item.id} className="mt-1 block" />
            )}
          </div>
          <div className="w-14 sm:w-24 shrink-0 text-xs text-gray-500 pt-0.5">
            {dueLabel ?? "—"}
          </div>
          <button
            // Stops the card's own click, so ✓ stays one tap rather than
            // opening the sheet on top of the completion.
            onClick={(e) => { e.stopPropagation(); completeTodo.mutate(item.id); }}
            disabled={completeTodo.isPending}
            className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mark complete"
          >
            ✓
          </button>
          <span className="w-9 sm:w-14 shrink-0 text-right text-sm font-mono pt-0.5">
            {item.point_value}
          </span>
          <span
            className={`w-10 sm:w-14 shrink-0 text-right text-sm font-mono font-bold pt-0.5 ${scoreColor}`}
          >
            {scoreDisplay}
          </span>
        </div>
      </div>
      {open && (
        <TodoDetailModal todoId={item.id} onClose={() => setOpen(false)} viewedDate={viewedDate} />
      )}
    </>
  );
}
