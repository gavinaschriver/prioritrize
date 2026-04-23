import { useState } from 'react';
import { getTodayStr } from '../lib/api';
import { useDashboard } from '../hooks/useDashboard';
import type { PrioritryStats, TagStats } from '../types';

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

// this is a comment

type SortDir = 'asc' | 'desc';

function getStartDate(days: number): string {
  const d = new Date(getTodayStr() + 'T12:00:00');
  d.setDate(d.getDate() - (days - 1));
  return d.toLocaleDateString('en-CA');
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function SortButton({ dir, onToggle }: { dir: SortDir; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 transition-colors"
      title={dir === 'desc' ? 'Sorted high → low (click to reverse)' : 'Sorted low → high (click to reverse)'}
    >
      {dir === 'desc' ? '↓' : '↑'}
    </button>
  );
}

function HabitRow({ stat, days }: { stat: PrioritryStats; days: number }) {
  const isTimeblock = stat.timeblock !== null;

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
            stat.type_name === 'Goal'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          }`}
        >
          {stat.type_name}
        </span>
        <span className="text-sm text-gray-800 truncate">{stat.name}</span>
      </div>
      <div className="shrink-0 ml-4 text-right">
        {isTimeblock ? (
          <span className="text-sm font-medium text-gray-700">
            {stat.total_minutes! > 0 ? formatMinutes(stat.total_minutes!) : '—'}
          </span>
        ) : (
          <span className={`text-sm font-medium ${stat.entry_count > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
            {stat.entry_count}
            <span className="text-xs text-gray-400 font-normal ml-1">/ {days}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function TagRow({ stat }: { stat: TagStats }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-blue-700 font-medium">#{stat.tag}</span>
      <span className="text-sm font-medium text-gray-800 shrink-0 ml-4">{stat.count}</span>
    </div>
  );
}

export function DashboardPage() {
  const [selectedDays, setSelectedDays] = useState(7);
  const [timeblockSort, setTimeblockSort] = useState<SortDir>('desc');
  const [habitSort, setHabitSort] = useState<SortDir>('desc');
  const [tagSort, setTagSort] = useState<SortDir>('desc');

  const today = getTodayStr();
  const start = getStartDate(selectedDays);

  const { data, isLoading, error } = useDashboard(start, today);

  const rawTimeblocks = data?.prioritry_stats.filter(s => s.timeblock !== null) ?? [];
  const rawHabits = data?.prioritry_stats.filter(s => s.timeblock === null) ?? [];
  const completedTodos = data?.todo_stats.filter(t => t.completed_in_range) ?? [];
  const rawTags = data?.tag_stats ?? [];

  const timeblockStats = [...rawTimeblocks].sort((a, b) =>
    timeblockSort === 'desc'
      ? (b.total_minutes ?? 0) - (a.total_minutes ?? 0)
      : (a.total_minutes ?? 0) - (b.total_minutes ?? 0)
  );

  const tagStats = [...rawTags].sort((a, b) =>
    tagSort === 'desc' ? b.count - a.count : a.count - b.count
  );

  // Goals first, then Bonuses; within each group sort by count
  const habitStats = [...rawHabits].sort((a, b) => {
    if (a.type_name !== b.type_name) return a.type_name === 'Goal' ? -1 : 1;
    return habitSort === 'desc'
      ? b.entry_count - a.entry_count
      : a.entry_count - b.entry_count;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-1">
          {PRESETS.map(p => (
            <button
              key={p.days}
              onClick={() => setSelectedDays(p.days)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                selectedDays === p.days
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-6">
        {start} — {today}
      </p>

      {isLoading && <p className="text-gray-400 text-sm text-center py-8">Loading...</p>}
      {error && <p className="text-red-600 text-sm text-center py-4">{(error as Error).message}</p>}

      {data && (
        <div className="space-y-8">

          {habitStats.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Goals &amp; Bonuses
                </h2>
                <SortButton dir={habitSort} onToggle={() => setHabitSort(d => d === 'desc' ? 'asc' : 'desc')} />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-4 divide-y divide-gray-100">
                {habitStats.map(stat => (
                  <HabitRow key={stat.prioritry_id} stat={stat} days={selectedDays} />
                ))}
              </div>
            </section>
          )}

          {timeblockStats.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Time Blocks
                </h2>
                <SortButton dir={timeblockSort} onToggle={() => setTimeblockSort(d => d === 'desc' ? 'asc' : 'desc')} />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-4 divide-y divide-gray-100">
                {timeblockStats.map(stat => (
                  <HabitRow key={stat.prioritry_id} stat={stat} days={selectedDays} />
                ))}
              </div>
            </section>
          )}

          {tagStats.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tags
                </h2>
                <SortButton dir={tagSort} onToggle={() => setTagSort(d => d === 'desc' ? 'asc' : 'desc')} />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 px-4 divide-y divide-gray-100">
                {tagStats.map(stat => (
                  <TagRow key={stat.tag} stat={stat} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Todos Completed
            </h2>
            {completedTodos.length === 0 ? (
              <p className="text-sm text-gray-400">None completed in this range.</p>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 px-4 divide-y divide-gray-100">
                {completedTodos.map(todo => (
                  <div key={todo.id} className="py-2 text-sm text-gray-800">
                    {todo.name}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
