import { useState } from "react";
import { TodoRow } from "./TodoRow";
import { SectionSubtotal, formatScore } from "./SectionSubtotal";
import type { TodoSummary } from "../../types";

type SortField = "created_at" | "point_value" | "due_date";
type SortDir = "asc" | "desc";

interface TodosSectionProps {
  todos: TodoSummary[];
  viewedDate: string;
  open: boolean;
  onToggle: () => void;
}

export function TodosSection({ todos, viewedDate, open, onToggle }: TodosSectionProps) {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "due_date",
    dir: "asc",
  });

  // Completed items leave the queue for the Completed Today list, so the subtotal
  // shown here is always the sum of the rows you can see.
  const pending = todos.filter((t) => t.completed_at === null);
  const subtotal = pending.reduce((sum, t) => sum + Number(t.score), 0);
  const subtotalColor = subtotal >= 0 ? "text-green-600" : "text-red-600";

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "created_at" ? "desc" : "asc" },
    );
  };

  const sorted = [...pending].sort((a, b) => {
    let cmp: number;
    if (sort.field === "created_at") {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sort.field === "due_date") {
      const aD = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bD = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      cmp = aD - bD;
    } else {
      cmp = a.point_value - b.point_value;
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const sortIcon = (field: SortField) =>
    sort.field !== field ? "↕" : sort.dir === "asc" ? "↑" : "↓";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>Todos</span>
        </button>
        {!open && (
          <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
            {formatScore(subtotal)}
          </span>
        )}
      </div>
      {open && (
        <>
          <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-400 font-medium px-0 mb-1">
            <div className="flex-1 min-w-0">Name</div>
            <button
              onClick={() => toggleSort("due_date")}
              className={`w-14 sm:w-24 shrink-0 text-left hover:text-gray-700 ${sort.field === "due_date" ? "text-blue-600" : ""}`}
            >
              Due {sortIcon("due_date")}
            </button>
            <button
              onClick={() => toggleSort("created_at")}
              className={`w-16 sm:w-20 shrink-0 text-left hover:text-gray-700 ${sort.field === "created_at" ? "text-blue-600" : ""}`}
            >
              Added {sortIcon("created_at")}
            </button>
            <div className="hidden sm:block w-40 shrink-0"></div>
            <button
              onClick={() => toggleSort("point_value")}
              className={`w-9 sm:w-14 shrink-0 text-right hover:text-gray-700 ${sort.field === "point_value" ? "text-blue-600" : ""}`}
            >
              Pts {sortIcon("point_value")}
            </button>
            <div className="w-10 sm:w-14 text-right shrink-0">Score</div>
          </div>
          {pending.length === 0 && (
            <p className="text-sm text-gray-400 py-2">
              Nothing left in the queue.
            </p>
          )}
          <div className="space-y-1">
            {sorted.map((t) => (
              <TodoRow key={t.id} item={t} viewedDate={viewedDate} />
            ))}
          </div>
          <SectionSubtotal label="Today's Todos Score" value={subtotal} />
        </>
      )}
    </div>
  );
}
