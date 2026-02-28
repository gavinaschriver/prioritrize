import { getTodayStr } from '../../lib/api';

interface DateNavigatorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function DateNavigator({ selectedDate, onDateChange }: DateNavigatorProps) {
  const today = getTodayStr();
  const isToday = selectedDate === today;

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    onDateChange(d.toLocaleDateString('en-CA'));
  };

  const formatDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    });
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <button
        onClick={() => shiftDate(-1)}
        className="px-3 py-1 text-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
      >
        &lt;
      </button>
      <div className="text-center">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{formatDisplay(selectedDate)}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => onDateChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-1 py-0.5"
          />
        </div>
        {!isToday && (
          <button
            onClick={() => onDateChange(today)}
            className="text-sm text-blue-600 hover:underline mt-1"
          >
            Jump back to today
          </button>
        )}
      </div>
      <button
        onClick={() => shiftDate(1)}
        disabled={isToday}
        className="px-3 py-1 text-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30"
      >
        &gt;
      </button>
    </div>
  );
}
