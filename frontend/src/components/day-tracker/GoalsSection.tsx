import { PrioritriRow } from './PrioritriRow';
import type { DayPrioritriSummary } from '../../types';

interface GoalsSectionProps {
  goals: DayPrioritriSummary[];
  subtotal: number;
  selectedDate: string;
}

export function GoalsSection({ goals, subtotal, selectedDate }: GoalsSectionProps) {
  const subtotalColor = subtotal >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Goals</h3>
        <p className="text-xs text-gray-400 italic">Unhit penalty = 1/2 point value + extra penalty</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-0 mb-1">
        <div className="flex-1">Name</div>
        <div className="w-8"></div>
        <div className="w-12 text-right">Pts</div>
        <div className="w-12 text-right">Pen.</div>
        <div className="w-10 text-center">#</div>
        <div className="w-14 text-right">Total</div>
      </div>
      {goals.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No goals yet. Add some in Manage.</p>
      )}
      {goals.map(g => (
        <PrioritriRow key={g.prioritri_id} item={g} isBonus={false} selectedDate={selectedDate} />
      ))}
      <div className="flex justify-end pt-2 border-t border-gray-200 mt-1">
        <span className={`text-sm font-bold font-mono ${subtotalColor}`}>
          {subtotal >= 0 ? '+' : ''}{subtotal % 1 === 0 ? subtotal : Number(subtotal).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
