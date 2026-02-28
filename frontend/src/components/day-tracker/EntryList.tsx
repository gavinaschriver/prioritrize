import { useDeleteEntry } from '../../hooks/useEntries';
import type { DaySummary } from '../../types';

interface EntryListProps {
  summary: DaySummary;
}

export function EntryList({ summary }: EntryListProps) {
  const deleteEntry = useDeleteEntry();

  // Collect all entries from goals and bonuses with their prioritri name
  const allEntries = [
    ...summary.goals.flatMap(g =>
      g.entries.map(e => ({ ...e, prioritriName: g.name, timeblock: g.timeblock }))
    ),
    ...summary.bonuses.flatMap(b =>
      b.entries.map(e => ({ ...e, prioritriName: b.name, timeblock: b.timeblock }))
    ),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allEntries.length === 0) return null;

  const formatName = (name: string, timeblock: number | null) => {
    if (timeblock) {
      const hours = Math.floor(timeblock / 60);
      const mins = timeblock % 60;
      const timeStr = hours > 0
        ? (mins > 0 ? `${hours} hr ${mins} min` : `${hours} hour`)
        : `${mins} min`;
      return `${name} ${timeStr}`;
    }
    return name;
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Today's Entries
      </h3>
      <div className="space-y-2">
        {allEntries.map(entry => (
          <div key={entry.id} className="flex items-start justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{formatName(entry.prioritriName, entry.timeblock)}</p>
              {entry.comment && (
                <p className="text-xs text-gray-500 italic mt-0.5">{entry.comment}</p>
              )}
            </div>
            <button
              onClick={() => deleteEntry.mutate(entry.id)}
              disabled={deleteEntry.isPending}
              className="shrink-0 ml-2 text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
