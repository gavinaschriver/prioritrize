import { PrioritryRow } from "./PrioritryRow";
import { SectionSubtotal, formatScore } from "./SectionSubtotal";
import type { DayPrioritrySummary } from "../../types";

interface GoalsSectionProps {
  goals: DayPrioritrySummary[];
  subtotal: number;
  selectedDate: string;
  open: boolean;
  onToggle: () => void;
}

export function GoalsSection({
  goals,
  subtotal,
  selectedDate,
  open,
  onToggle,
}: GoalsSectionProps) {
  const subtotalColor = subtotal >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>Daily Goals</span>
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
            <div className="flex-1">Name</div>
            <div className="w-[5.75rem] sm:w-32"></div>
            <div className="w-7 sm:w-12 text-right">Pts</div>
            <div className="w-6 sm:w-10 text-center">#</div>
            <div className="w-11 sm:w-14 text-right">Total</div>
          </div>
          {goals.length === 0 && (
            <p className="text-sm text-gray-400 py-2">
              No goals yet. Add some in Manage.
            </p>
          )}
          {goals.map((g) => (
            <PrioritryRow
              key={g.prioritry_id}
              item={g}
              isBonus={false}
              selectedDate={selectedDate}
            />
          ))}
          <SectionSubtotal label="Today's Goals Score" value={subtotal} />
        </>
      )}
    </div>
  );
}
