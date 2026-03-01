import { usePrioritries, useDeletePrioritry } from '../../hooks/usePrioritries';
import type { Prioritry } from '../../types';

interface PrioritryListProps {
  onEdit: (p: Prioritry) => void;
}

export function PrioritryList({ onEdit }: PrioritryListProps) {
  const { data: prioritries, isLoading } = usePrioritries();
  const deletePrioritry = useDeletePrioritry();

  if (isLoading) return <p className="text-gray-400 text-sm">Loading...</p>;
  if (!prioritries?.length) return <p className="text-gray-400 text-sm">No PrioriTries yet. Add one above.</p>;

  const goals = prioritries.filter(p => p.type_name === 'Goal');
  const bonuses = prioritries.filter(p => p.type_name === 'Bonus');

  const renderItem = (p: Prioritry) => (
    <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{p.name}</span>
        <span className="ml-2 text-xs text-gray-400">
          {p.point_value} pts
          {p.extra_penalty > 0 && ` / ${p.extra_penalty} pen.`}
          {p.timeblock && ` / ${p.timeblock} min`}
          {p.can_repeat && ' / repeatable'}
        </span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onEdit(p)}
          className="text-xs text-blue-600 hover:underline"
        >
          Edit
        </button>
        <button
          onClick={() => deletePrioritry.mutate(p.id)}
          disabled={deletePrioritry.isPending}
          className="text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          Deactivate
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {goals.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Goals</h4>
          {goals.map(renderItem)}
        </div>
      )}
      {bonuses.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Bonuses</h4>
          {bonuses.map(renderItem)}
        </div>
      )}
    </div>
  );
}
