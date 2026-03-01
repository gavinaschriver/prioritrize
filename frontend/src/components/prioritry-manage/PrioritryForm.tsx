import { useState, useEffect } from 'react';
import { useCreatePrioritry, useUpdatePrioritry } from '../../hooks/usePrioritries';
import { Tooltip } from '../shared/Tooltip';
import type { Prioritry, PrioritryCreate } from '../../types';

interface PrioritryFormProps {
  editing?: Prioritry | null;
  onDone: () => void;
}

const GOAL_TYPE_ID = 1;
const BONUS_TYPE_ID = 2;

export function PrioritryForm({ editing, onDone }: PrioritryFormProps) {
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(GOAL_TYPE_ID);
  const [pointValue, setPointValue] = useState('10');
  const [canRepeat, setCanRepeat] = useState(false);
  const [timeblock, setTimeblock] = useState('');
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [extraPenalty, setExtraPenalty] = useState('0');
  const [error, setError] = useState('');

  const createPrioritry = useCreatePrioritry();
  const updatePrioritry = useUpdatePrioritry();

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setTypeId(editing.type_id);
      setPointValue(editing.point_value.toString());
      setCanRepeat(editing.can_repeat);
      setTimeblock(editing.timeblock?.toString() || '');
      setCommentsEnabled(editing.comments_enabled);
      setExtraPenalty(editing.extra_penalty.toString());
    }
  }, [editing]);

  const isBonus = typeId === BONUS_TYPE_ID;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedPointValue = pointValue === '' ? NaN : parseInt(pointValue);
    if (isNaN(parsedPointValue) || parsedPointValue < 0) {
      setError('Point value must be 0 or greater');
      return;
    }

    const data: PrioritryCreate = {
      name,
      type_id: typeId,
      point_value: parsedPointValue,
      can_repeat: canRepeat,
      timeblock: timeblock ? parseInt(timeblock) : null,
      comments_enabled: commentsEnabled,
      extra_penalty: isBonus ? 0 : (extraPenalty === '' ? 0 : parseInt(extraPenalty) || 0),
    };

    try {
      if (editing) {
        await updatePrioritry.mutateAsync({ id: editing.id, data });
      } else {
        await createPrioritry.mutateAsync(data);
      }
      // Reset form
      setName('');
      setTypeId(GOAL_TYPE_ID);
      setPointValue('10');
      setCanRepeat(false);
      setTimeblock('');
      setCommentsEnabled(false);
      setExtraPenalty('0');
      onDone();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">
        {editing ? 'Edit PrioriTry' : 'Add New PrioriTry'}
      </h3>
      {error && <p className="text-red-600 text-xs">{error}</p>}

      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 flex items-center">
            Type
            <Tooltip text="Goals are things you want to strive to do every day. If you haven't hit a Goal, you'll be penalized 1/2 of its point value by default, plus any extra penalty you assign to it. A Bonus is a nice-to-have extra to tack on — think of a weekly chore like laundry or meal prep." />
          </label>
          <select
            value={typeId}
            onChange={e => setTypeId(parseInt(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          >
            <option value={GOAL_TYPE_ID}>Goal</option>
            <option value={BONUS_TYPE_ID}>Bonus</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Point Value</label>
          <input
            type="number"
            min={0}
            value={pointValue}
            onChange={e => setPointValue(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 flex items-center">
            Timeblock (minutes)
            <Tooltip text="Add a time block for a Goal that you want to have a target duration — e.g. Exercise 25 minutes. You'll be able to track the time you spent on these blocks for more insight the more you Priori-try!" />
          </label>
          <input
            type="number"
            min={1}
            placeholder="Optional"
            value={timeblock}
            onChange={e => setTimeblock(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 flex items-center">
            Extra Penalty
            <Tooltip text="If the 1/2 Point Value default isn't enough motivation, you can ramp up how much missing a Goal will deduct from your score — think of things that you REALLY shouldn't miss in a day!" />
          </label>
          <input
            type="number"
            value={isBonus ? '0' : extraPenalty}
            onChange={e => setExtraPenalty(e.target.value)}
            disabled={isBonus}
            placeholder="Optional"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={canRepeat}
            onChange={e => setCanRepeat(e.target.checked)}
            className="rounded"
          />
          Can repeat?
          <Tooltip text="Select this option if you want to be able to record multiple entries of the same PrioriTry in a given day — great for timeblock items!" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={commentsEnabled}
            onChange={e => setCommentsEnabled(e.target.checked)}
            className="rounded"
          />
          Comments enabled?
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createPrioritry.isPending || updatePrioritry.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {editing ? 'Update' : 'Add'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
