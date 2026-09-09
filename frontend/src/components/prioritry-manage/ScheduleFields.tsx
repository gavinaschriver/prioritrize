interface ScheduleFieldsProps {
  everyDays: string;
  onEveryDays: (value: string) => void;
  startsOn: string;
  onStartsOn: (value: string) => void;
}

/** Reads the two inputs back as a sentence: "every Friday, starting Sep 11".
 *
 *  The schedule has no weekday setting -- "every Friday" is every 7 days anchored
 *  on a Friday -- so this is what tells you the anchor you picked is the day you
 *  meant. Without it, choosing the wrong start date is invisible until a todo
 *  turns up on a Thursday. */
function describe(everyDays: string, startsOn: string): string | null {
  const n = parseInt(everyDays);
  if (isNaN(n) || n < 1) return null;
  if (!startsOn) return n === 1 ? 'Every day.' : `Every ${n} days.`;

  // Noon-anchored like every other date-only parse in the app, so a DST shift
  // can't slide the weekday backwards.
  const start = new Date(startsOn + 'T12:00:00');
  const weekday = start.toLocaleDateString(undefined, { weekday: 'long' });
  const shortDate = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (n === 1) return `Every day, starting ${shortDate}.`;
  if (n === 7) return `Every ${weekday}, starting ${shortDate}.`;
  if (n === 14) return `Every other ${weekday}, starting ${shortDate}.`;
  return `Every ${n} days, starting ${shortDate}.`;
}

/** "Repeat every N days, starting <date>" -- the whole schedule.
 *
 *  Deliberately not a weekday picker or a day-of-month field: an interval plus an
 *  anchor covers every case this app needs, and the date picker already answers
 *  "which Friday". */
export function ScheduleFields({ everyDays, onEveryDays, startsOn, onStartsOn }: ScheduleFieldsProps) {
  const summary = describe(everyDays, startsOn);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="shrink-0">
          <label className="text-xs text-gray-500">Repeat every</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={everyDays}
              onChange={e => onEveryDays(e.target.value)}
              className="w-16 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">days</span>
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">Starting</label>
          <input
            type="date"
            value={startsOn}
            onChange={e => onStartsOn(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      {summary && <p className="text-xs text-blue-700">{summary}</p>}
      <p className="text-xs text-gray-500">
        Appears on its own, due that day. If the last one is still open, the next waits.
      </p>
    </div>
  );
}
