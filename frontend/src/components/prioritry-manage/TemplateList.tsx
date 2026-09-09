import { useState } from 'react';
import { CategoryChip } from '../shared/CategorySelect';
import { ScheduleFields } from './ScheduleFields';
import {
  useTemplates, useUpdateTemplate, useDeleteTemplate, describeSchedule,
} from '../../hooks/useTemplates';
import type { ItemTemplate } from '../../types';

/** "due Sat, Sep 12" — the occurrence this series currently has in your queue.
 *
 *  A schedule always has exactly one live occurrence: materializing stamps
 *  last_materialized_on, and the following one isn't made until that todo is
 *  completed. So the watermark is the date of the todo you can see right now, and
 *  showing the one after it would name a todo that doesn't exist yet. */
function liveOccurrence(t: ItemTemplate): string | null {
  const on = t.last_materialized_on ?? t.starts_on;
  if (t.repeat_every_days === null || !on) return null;
  // Noon-anchored so a DST shift can't slide the date a day backwards.
  return new Date(on + 'T12:00:00')
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function TemplateRow({ t }: { t: ItemTemplate }) {
  const [editing, setEditing] = useState(false);
  const [everyDays, setEveryDays] = useState(String(t.repeat_every_days ?? 7));
  const [startsOn, setStartsOn] = useState(t.starts_on ?? '');
  const update = useUpdateTemplate();
  const remove = useDeleteTemplate();

  const recurring = t.repeat_every_days !== null;
  const live = liveOccurrence(t);

  const saveSchedule = async () => {
    const n = parseInt(everyDays);
    if (isNaN(n) || n < 1 || !startsOn) return;
    await update.mutateAsync({ id: t.id, data: { repeat_every_days: n, starts_on: startsOn } });
    setEditing(false);
  };

  return (
    <div className={`rounded-lg border p-3 ${t.paused ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <span className={`flex-1 min-w-0 text-sm ${t.paused ? 'text-gray-500' : 'text-gray-800'}`}>
          {t.name}
        </span>
        <CategoryChip categoryId={t.category_id} />
        {t.point_value > 0 && (
          <span className="text-xs text-gray-500 font-mono shrink-0">{t.point_value}pts</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
        <span className="text-xs text-gray-500">
          {describeSchedule(t)}
          {recurring && !t.paused && live && <span className="text-gray-400"> · due {live}</span>}
        </span>
        <span className="flex-1" />
        {recurring && (
          <>
            <button
              onClick={() => update.mutate({ id: t.id, data: { paused: !t.paused } })}
              disabled={update.isPending}
              className="text-xs text-gray-500 hover:text-blue-500 disabled:opacity-50"
            >
              {t.paused ? 'resume' : 'pause'}
            </button>
            <button
              onClick={() => setEditing(v => !v)}
              className="text-xs text-gray-500 hover:text-blue-500"
            >
              {editing ? 'cancel' : 'edit schedule'}
            </button>
          </>
        )}
        <button
          onClick={() => remove.mutate(t.id)}
          disabled={remove.isPending}
          className="text-xs text-gray-500 hover:text-red-500 disabled:opacity-50"
          title="Todos this already made are kept"
        >
          delete
        </button>
      </div>

      {editing && (
        <div className="mt-2 space-y-2">
          <ScheduleFields
            everyDays={everyDays}
            onEveryDays={setEveryDays}
            startsOn={startsOn}
            onStartsOn={setStartsOn}
          />
          <button
            onClick={saveSchedule}
            disabled={update.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save schedule
          </button>
        </div>
      )}
    </div>
  );
}

/** Where templates are edited, paused and retired.
 *
 *  Required rather than optional: the tracker's dropdown can only add, so without
 *  this there is no way to stop a recurring chore or fix an interval. */
export function TemplateList() {
  const { data: templates, isLoading } = useTemplates('todo');
  if (isLoading || !templates || templates.length === 0) return null;

  // Recurring ones first -- they're the ones that act on their own, so they're the
  // ones worth checking on.
  const sorted = [...templates].sort((a, b) => {
    const rank = (t: ItemTemplate) => (t.repeat_every_days === null ? 1 : 0);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Templates &amp; Repeats
      </h3>
      {sorted.map(t => <TemplateRow key={t.id} t={t} />)}
    </div>
  );
}
