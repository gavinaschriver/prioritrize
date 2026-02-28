import { useState } from 'react';
import { useCreateEntry } from '../../hooks/useEntries';
import type { DayPrioritriSummary } from '../../types';

interface PrioritriRowProps {
  item: DayPrioritriSummary;
  isBonus: boolean;
  selectedDate: string;
}

export function PrioritriRow({ item, isBonus, selectedDate }: PrioritriRowProps) {
  const [comment, setComment] = useState('');
  const createEntry = useCreateEntry();

  const canAdd = item.can_repeat || item.entry_count === 0;
  const totalValue = Number(item.total_value);
  const totalColor = totalValue > 0 ? 'text-green-600' : totalValue < 0 ? 'text-red-600' : 'text-gray-500';

  const handleAdd = () => {
    createEntry.mutate({
      prioritri_id: item.prioritri_id,
      comment: item.comments_enabled && comment.trim() ? comment.trim() : undefined,
      target_date: selectedDate,
    });
    setComment('');
  };

  const formatName = () => {
    if (item.timeblock) {
      const hours = Math.floor(item.timeblock / 60);
      const mins = item.timeblock % 60;
      const timeStr = hours > 0
        ? (mins > 0 ? `${hours} hr ${mins} min` : `${hours} hour`)
        : `${mins} min`;
      return <>{item.name} <span className="font-bold">{timeStr}</span></>;
    }
    return item.name;
  };

  return (
    <div className="border-b border-gray-100 py-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-sm">{formatName()}</span>
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAdd || createEntry.isPending}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg text-lg font-bold hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
        <span className="w-12 text-right text-sm font-mono">{item.point_value}</span>
        <span className="w-12 text-right text-sm font-mono text-gray-500">
          {isBonus ? '-' : item.extra_penalty}
        </span>
        <span className="w-10 text-center text-sm font-mono">{item.entry_count}</span>
        <span className={`w-14 text-right text-sm font-mono font-bold ${totalColor}`}>
          {totalValue > 0 ? '+' : ''}{totalValue % 1 === 0 ? totalValue : totalValue.toFixed(1)}
        </span>
      </div>
      {item.comments_enabled && (
        <div className="mt-1 ml-0">
          <input
            type="text"
            placeholder="Comment (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canAdd) handleAdd(); }}
            className="w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}
    </div>
  );
}
