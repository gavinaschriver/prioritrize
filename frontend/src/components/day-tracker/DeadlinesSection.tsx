import { useState } from "react";
import { useProjects } from "../../hooks/useProjects";
import { DeadlineRow } from "./DeadlineRow";
import { SectionSubtotal, formatScore } from "./SectionSubtotal";
import type { DeadlineSummary } from "../../types";

/** Rows revealed per click, matching the hybrid queue. */
const PAGE = 10;

/** Filter value meaning "every project". */
const ALL = "";

type SortField = "point_value" | "due_date";
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
  // The filter offers every project, so it can't be built from today's rows alone.
  const { data: allProjects } = useProjects();
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "due_date",
    dir: "asc",
  });

  // Completed items leave the queue for the Completed Today list. The subtotal
  // covers every pending row, filtered out or not — it's the day's score, and
  // narrowing the view doesn't change what the day is worth.
  const pending = deadlines.filter((d) => d.completed_at === null);
  const subtotal = pending.reduce((sum, d) => sum + Number(d.score), 0);
  const subtotalColor = subtotal >= 0 ? "text-green-600" : "text-red-600";

  // Rows first, so a project still shows up while the projects list is loading —
  // and so a completed project that somehow still owes a task keeps its slot.
  // A project's own deadline row carries no project_id: it is the project.
  const namesById = new Map<string, string>();
  const pendingById = new Map<string, number>();
  for (const d of pending) {
    const pid = d.type === "project" ? d.id : d.project_id;
    if (!pid) continue;
    namesById.set(
      pid,
      d.type === "project" ? d.name : (d.project_name ?? "Untitled project"),
    );
    pendingById.set(pid, (pendingById.get(pid) ?? 0) + 1);
  }
  // Then every open project. One whose tasks are all done has nothing in today's
  // list, but you should still be able to point the filter at it — the count in
  // the option says it'll be empty before you pick it.
  for (const p of allProjects ?? []) {
    if (p.completed_at === null) namesById.set(p.id, p.name);
  }
  const projects = [...namesById].sort((a, b) => a[1].localeCompare(b[1]));

  // Finishing the last task of the filtered project empties the list out from
  // under the filter, so a filter that no longer matches anything falls back to All.
  const activeFilter = projects.some(([id]) => id === projectFilter)
    ? projectFilter
    : ALL;

  const filtered =
    activeFilter === ALL
      ? pending
      : pending.filter(
          (d) =>
            d.project_id === activeFilter ||
            (d.type === "project" && d.id === activeFilter),
        );

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp: number;
    if (sort.field === "due_date") {
      const aD = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bD = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      cmp = aD - bD;
    } else {
      cmp = (a.point_value ?? 0) - (b.point_value ?? 0);
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const visible = sorted.slice(0, visibleCount);
  const remaining = sorted.length - visible.length;

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
        {open && projects.length > 0 && (
          <select
            value={activeFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              // A different list starts at the top.
              setVisibleCount(PAGE);
            }}
            className={`text-xs px-2 py-1 rounded-lg border bg-white ${
              activeFilter === ALL
                ? "border-gray-200 text-gray-500"
                : "border-blue-200 text-blue-600 font-medium"
            }`}
            title="Show only one project's tasks"
          >
            <option value={ALL}>All projects ({pending.length})</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name} ({pendingById.get(id) ?? 0})
              </option>
            ))}
          </select>
        )}
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
            <div className="hidden sm:block w-40 shrink-0"></div>
            <button
              onClick={() => toggleSort("point_value")}
              className={`w-9 sm:w-14 shrink-0 text-right hover:text-gray-700 ${sort.field === "point_value" ? "text-blue-600" : ""}`}
            >
              Pts {sortIcon("point_value")}
            </button>
            <div className="w-10 sm:w-14 text-right shrink-0">Score</div>
          </div>

          {sorted.length === 0 && (
            <p className="text-sm text-gray-500 py-2">
              {activeFilter === ALL
                ? "Nothing left in the queue. Add projects or tasks to fill it."
                : "Nothing pending on this project."}
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

          {(remaining > 0 || visibleCount > PAGE) && (
            <div className="flex items-center gap-3 mt-2">
              {remaining > 0 && (
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE)}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Show {Math.min(PAGE, remaining)} more ({remaining} left)
                </button>
              )}
              {visibleCount > PAGE && (
                <button
                  onClick={() => setVisibleCount(PAGE)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Show less
                </button>
              )}
            </div>
          )}

          <SectionSubtotal label="Today's Tasks Score" value={subtotal} />
        </>
      )}
    </div>
  );
}
