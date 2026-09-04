import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompleteProject, useCompleteProjectTask } from "../../hooks/useProjects";
import { urgencyRow, formatDueDate } from "../../lib/urgency";
import { TaskDetailModal } from "../shared/TaskDetailModal";
import { DeferredBadge } from "../shared/DeferredBadge";
import { DueBadge } from "../shared/DueBadge";
import { ActivateButton } from "../shared/ActivateButton";
import { RefNumber } from "../shared/RefNumber";
import type { DeadlineSummary } from "../../types";

interface DeadlineRowProps {
  item: DeadlineSummary;
  viewedDate: string;
}

export function DeadlineRow({ item, viewedDate }: DeadlineRowProps) {
  // Tasks open the detail sheet; projects already have a full page of their own,
  // so tapping one goes there instead of into a smaller version of it.
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const completeProject = useCompleteProject();
  const completeTask = useCompleteProjectTask(item.project_id ?? item.id);

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
  const isPending = completeProject.isPending || completeTask.isPending;

  const handleComplete = () => {
    if (item.type === "project") completeProject.mutate(item.id);
    else completeTask.mutate(item.id);
  };

  const handleOpen = () => {
    if (item.type === "project") navigate(`/projects/${item.id}`);
    else setOpen(true);
  };

  return (
    <>
      <div
        className={`py-2 cursor-pointer ${row.className}`}
        style={row.style}
        onClick={handleOpen}
        title={item.type === "project" ? "Open project" : "Open details"}
      >
        <div className="flex items-start gap-1 sm:gap-2">
          <div className="flex-1 min-w-0">
            <RefNumber number={item.ref_number} className="mr-1.5" />
            <span className="text-sm text-gray-900 wrap-break-word">{item.name}</span>
            {item.deferred && (
              <DeferredBadge effectiveDueDate={item.effective_due_date} />
            )}
            <DueBadge dueDate={item.effective_due_date} viewedDate={viewedDate} />
            {/* Projects aren't worked on directly -- their tasks are. */}
            {item.type === "task" && !item.completed_at && (
              <ActivateButton type="project_task" id={item.id} className="mt-1 block" />
            )}
            {item.type === "task" && item.project_name && item.project_id && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/projects/${item.project_id}`); }}
                className="block w-fit mt-0.5 sm:mt-1.5 text-xs font-bold uppercase text-gray-600 hover:underline hover:text-blue-500 wrap-break-word text-left"
              >
                {item.project_name}
              </button>
            )}
          </div>
          <div className="w-14 sm:w-24 shrink-0 text-xs text-gray-500 pt-0.5">
            {dueLabel ?? "—"}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleComplete(); }}
            disabled={isPending}
            className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mark complete"
          >
            ✓
          </button>
          <span className="w-9 sm:w-14 shrink-0 text-right text-sm font-mono pt-0.5">
            {item.point_value != null ? item.point_value : "—"}
          </span>
          <span
            className={`w-10 sm:w-14 shrink-0 text-right text-sm font-mono font-bold pt-0.5 ${scoreColor}`}
          >
            {scoreDisplay}
          </span>
        </div>
      </div>
      {open && item.type === "task" && item.project_id && (
        <TaskDetailModal
          projectId={item.project_id}
          taskId={item.id}
          onClose={() => setOpen(false)}
          viewedDate={viewedDate}
        />
      )}
    </>
  );
}
