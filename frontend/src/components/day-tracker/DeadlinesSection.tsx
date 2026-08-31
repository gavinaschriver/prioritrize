import { useState } from "react";
import { DeadlineRow } from "./DeadlineRow";
import { SectionSubtotal, formatScore } from "./SectionSubtotal";
import type { DeadlineSummary } from "../../types";

const DEFAULT_VISIBLE = 5;

type SortField = "created_at" | "point_value" | "due_date";
type SortDir = "asc" | "desc";

interface DeadlinesSectionProps {
  deadlines: DeadlineSummary[];
  viewedDate: string;
  open: boolean;
  onToggle: () => void;
}

export function DeadlinesSection({
  deadlines,
  viewedDate,
  open,
  onToggle,
}: DeadlinesSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "due_date",
    dir: "asc",
  });

  // Completed items leave the queue for the Completed Today list, so the subtotal
  // shown here is always the sum of the rows you can see.
  const pending = deadlines.filter((d) => d.completed_at === null);
  const subtotal = pending.reduce((sum, d) => sum + Number(d.score), 0);
  const subtotalColor = subtotal >= 0 ? "text-green-600" : "text-red-600";
  const hasMore = pending.length > DEFAULT_VISIBLE;

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
      cmp = (a.point_value ?? 0) - (b.point_value ?? 0);
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_VISIBLE);

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
          <span>Tasks</span>
        </button>
        {!open && (
          <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
            {formatScore(subtotal)}
          </span>
        )}
      </div>
      {open && (
        <>
          <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-500 font-medium px-0 mb-1">
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
            <p className="text-sm text-gray-500 py-2">
              Nothing left in the queue. Add projects or tasks to fill it.
            </p>
          )}

          <div className="space-y-1">
            {visible.map((d) => (
              <DeadlineRow
                key={`${d.type}-${d.id}`}
                item={d}
                viewedDate={viewedDate}
              />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="mt-2 text-xs text-blue-500 hover:underline"
            >
              {showAll
                ? "Show less"
                : `Show ${pending.length - DEFAULT_VISIBLE} more`}
            </button>
          )}

          <SectionSubtotal label="Today's Tasks Score" value={subtotal} />
        </>
      )}
    </div>
  );
}
