import { useState } from 'react';
import { CategorySelect } from '../shared/CategorySelect';
import { useCreateTodo } from '../../hooks/useTodos';
import { useCreateTemplate } from '../../hooks/useTemplates';
import { TagCommentInput } from '../day-tracker/TagCommentInput';
import { ScheduleFields } from './ScheduleFields';
import { getTodayStr } from '../../lib/api';

/** What this form builds. Neither box checked is the original behaviour. */
type Mode = 'once' | 'template' | 'recurring';

const SUBMIT_LABEL: Record<Mode, string> = {
  once: 'Add Todo',
  template: 'Save Template',
  recurring: 'Create Recurring Todo',
};

export function TodoForm() {
  const [mode, setMode] = useState<Mode>('once');
  const [name, setName] = useState('');
  const [pointValue, setPointValue] = useState('5');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [everyDays, setEveryDays] = useState('7');
  const [startsOn, setStartsOn] = useState(getTodayStr());
  const [error, setError] = useState('');

  const createTodo = useCreateTodo();
  const createTemplate = useCreateTemplate();
  const pending = createTodo.isPending || createTemplate.isPending;

  /** The two boxes are mutually exclusive but neither is required, so clicking the
   *  checked one turns it back off rather than trapping you in a mode. */
  const toggle = (target: Exclude<Mode, 'once'>) =>
    setMode(prev => (prev === target ? 'once' : target));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseInt(pointValue);
    if (isNaN(parsed) || parsed < 0) {
      setError('Point value must be 0 or greater');
      return;
    }

    const interval = parseInt(everyDays);
    if (mode === 'recurring' && (isNaN(interval) || interval < 1)) {
      setError('Repeat interval must be 1 day or more');
      return;
    }
    if (mode === 'recurring' && !startsOn) {
      setError('A repeating todo needs a start date');
      return;
    }

    try {
      if (mode === 'once') {
        await createTodo.mutateAsync({
          name,
          point_value: parsed,
          due_date: dueDate || null,
          description: description.trim() || null,
          category_id: categoryId || null,
        });
      } else {
        await createTemplate.mutateAsync({
          name,
          point_value: parsed,
          description: description.trim() || null,
          category_id: categoryId || null,
          kind: 'todo',
          // The one field that separates the two: an interval makes it generate
          // itself, its absence leaves it waiting in the tracker's dropdown.
          repeat_every_days: mode === 'recurring' ? interval : null,
          starts_on: mode === 'recurring' ? startsOn : null,
        });
      }
      setName('');
      setPointValue('5');
      setDueDate('');
      setDescription('');
      // categoryId deliberately survives: todos get added in runs, and a run is
      // usually all the same category. So does mode -- templates get added in runs too.
    } catch (err: any) {
      setError(err.message);
    }
  };

  const heading =
    mode === 'once' ? 'Add New Todo'
      : mode === 'template' ? 'Save a Reusable Todo'
        : 'Add a Repeating Todo';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{heading}</h3>
      {error && <p className="text-red-600 text-xs">{error}</p>}

      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={mode === 'template'}
            onChange={() => toggle('template')}
            className="accent-blue-600"
          />
          Save as template
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={mode === 'recurring'}
            onChange={() => toggle('recurring')}
            className="accent-blue-600"
          />
          Set recurring schedule
        </label>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Point Value <span className="text-gray-500">(0 = reminder)</span></label>
          <input
            type="number"
            min={0}
            value={pointValue}
            onChange={e => setPointValue(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        {/* A blueprint has no due date -- the date comes from the schedule, or from
            the prompt when you pick it out of the dropdown. */}
        {mode === 'once' && (
          <div className="flex-1">
            <label className="text-xs text-gray-500">Due Date <span className="text-gray-500">(optional)</span></label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        )}
      </div>

      {mode === 'recurring' && (
        <ScheduleFields
          everyDays={everyDays}
          onEveryDays={setEveryDays}
          startsOn={startsOn}
          onStartsOn={setStartsOn}
        />
      )}

      {mode === 'template' && (
        <p className="text-xs text-gray-500">
          Saved for later, not added to your queue. Pull it in from “+ Template” on the tracker.
        </p>
      )}

      <div>
        <label className="text-xs text-gray-500">Category <span className="text-gray-500">(optional)</span></label>
        <CategorySelect value={categoryId} onChange={setCategoryId} />
      </div>

      <div>
        <label className="text-xs text-gray-500">Description <span className="text-gray-500">(optional, editable later)</span></label>
        <TagCommentInput
          value={description}
          onChange={setDescription}
          placeholder="What to do, notes on how, or #tag, — markdown welcome"
          multiline
          className="mt-1"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {SUBMIT_LABEL[mode]}
      </button>
    </form>
  );
}
