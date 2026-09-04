import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useCompleteProject,
  useCompleteProjectTask,
  useUpdateProjectTask,
} from "../../hooks/useProjects";
import { urgencyRow, formatDueDate } from "../../lib/urgency";
import { DescriptionAndComment } from "../shared/DescriptionAndComment";
import { ConvertTaskToTodo } from "../shared/ConvertTaskToTodo";
import { DeferredBadge } from "../shared/DeferredBadge";
import { DueBadge } from "../shared/DueBadge";
import type { DeadlineSummary } from "../../types";

interface DeadlineRowProps {
  item: DeadlineSummary;
  viewedDate: string;
}

export function DeadlineRow({ item, viewedDate }: DeadlineRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPts, setEditPts] = useState(
    item.point_value != null ? String(item.point_value) : "",
  );
  const [editDue, setEditDue] = useState(item.due_date ?? "");

  const completeProject = useCompleteProject();
  const completeTask = useCompleteProjectTask(item.project_id ?? item.id);
  const updateTask = useUpdateProjectTask(item.project_id ?? item.id);

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

  const handleComplete = () => {
    if (item.type === "project") {
      completeProject.mutate(item.id);
    } else {
      completeTask.mutate(item.id);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pv = editPts.trim() !== "" ? parseInt(editPts) : 0;
    await updateTask.mutateAsync({
      taskId: item.id,
      data: {
        name: editName,
        point_value: isNaN(pv) ? 0 : pv,
        due_date: editDue || null,
      },
    });
    setEditing(false);
  };

  const isPending = completeProject.isPending || completeTask.isPending;
  const detailLink =
    item.type === "project"
      ? `/projects/${item.id}`
      : `/projects/${item.project_id}`;

  if (editing && item.type === "task") {
    return (
      <div className={`py-2 ${row.className}`} style={row.style}>
        <form
          onSubmit={handleSaveEdit}
          className="flex items-center gap-2 flex-wrap"
        >
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
            className="flex-1 min-w-32 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <input
            type="number"
            min={0}
            value={editPts}
            onChange={(e) => setEditPts(e.target.value)}
            placeholder="pts"
            className="w-14 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <input
            type="date"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
            className="w-36 px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <button
            type="submit"
            disabled={updateTask.isPending}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  const convertEditActions = (
    <>
      {item.type === "task" && item.project_id && (
        <ConvertTaskToTodo projectId={item.project_id} taskId={item.id} />
      )}
      {item.type === "task" && (
        <button
          onClick={() => {
            setEditName(item.name);
            setEditPts(
              item.point_value != null ? String(item.point_value) : "",
            );
            setEditDue(item.due_date ?? "");
            setEditing(true);
          }}
          className="shrink-0 text-gray-500 hover:text-blue-500 text-sm"
          title="Edit task"
        >
          ✎
        </button>
      )}
    </>
  );

  const completeButton = (
    <button
      onClick={handleComplete}
      disabled={isPending}
      className="shrink-0 w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
      title="Mark complete"
    >
      ✓
    </button>
  );

  return (
    <div className={`py-2 ${row.className}`} style={row.style}>
      <div className="flex items-start gap-1 sm:gap-2">
        <div className="flex-1 min-w-0">
          {item.type === "project" ? (
            <Link
              to={detailLink}
              className="text-sm hover:underline text-gray-900 wrap-break-word"
            >
              {item.name}
            </Link>
          ) : (
            <span className="text-sm text-gray-900 wrap-break-word">
              {item.name}
            </span>
          )}
          {item.deferred && (
            <DeferredBadge effectiveDueDate={item.effective_due_date} />
          )}
          <DueBadge dueDate={item.effective_due_date} viewedDate={viewedDate} />
          {item.type === "task" && item.project_name && item.project_id && (
            <Link
              to={`/projects/${item.project_id}`}
              className="block w-fit mt-0.5 sm:mt-1.5 text-xs font-bold uppercase text-gray-600 hover:underline hover:text-blue-500 wrap-break-word"
            >
              {item.project_name}
            </Link>
          )}
        </div>
        <div className="w-14 sm:w-24 shrink-0 text-xs text-gray-500 pt-0.5">
          {dueLabel ?? "—"}
        </div>
        <div className="hidden sm:flex w-40 shrink-0 items-center justify-end gap-2">
          {convertEditActions}
          {completeButton}
        </div>
        <span className="w-9 sm:w-14 shrink-0 text-right text-sm font-mono pt-0.5">
          {item.point_value != null ? item.point_value : "—"}
        </span>
        <span
          className={`w-10 sm:w-14 shrink-0 text-right text-sm font-mono font-bold pt-0.5 ${scoreColor}`}
        >
          {scoreDisplay}
        </span>
      </div>
      <div className="flex sm:hidden items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">{convertEditActions}</div>
        {completeButton}
      </div>
      {item.type === "task" && (
        <div className="sm:mt-1.5">
          <DescriptionAndComment
            description={item.description}
            comment={item.comment}
            onSaveDescription={(description) =>
              updateTask.mutate({ taskId: item.id, data: { description } })
            }
            onSaveComment={(comment) =>
              updateTask.mutate({ taskId: item.id, data: { comment } })
            }
            attachTo={{ type: 'project_task', id: item.id }}
          />
        </div>
      )}
    </div>
  );
}
