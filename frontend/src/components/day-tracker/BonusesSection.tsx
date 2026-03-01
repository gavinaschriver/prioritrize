import { PrioritryRow } from './PrioritryRow';
import type { DayPrioritrySummary } from '../../types';

interface BonusesSectionProps {
  bonuses: DayPrioritrySummary[];
  subtotal: number;
  selectedDate: string;
}

export function BonusesSection({ bonuses, subtotal, selectedDate }: BonusesSectionProps) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Bonuses</h3>
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-0 mb-1">
        <div className="flex-1">Name</div>
        <div className="w-8"></div>
        <div className="w-12 text-right">Pts</div>
        <div className="w-10 text-center">#</div>
        <div className="w-14 text-right">Total</div>
      </div>
      {bonuses.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No bonuses yet.</p>
      )}
      {bonuses.map(b => (
        <PrioritryRow key={b.prioritry_id} item={b} isBonus={true} selectedDate={selectedDate} />
      ))}
      <div className="flex justify-end pt-2 border-t border-gray-200 mt-1">
        <span className="text-sm font-bold font-mono text-green-600">
          +{Number(subtotal).toFixed(subtotal % 1 === 0 ? 0 : 1)}
        </span>
      </div>
    </div>
  );
}
