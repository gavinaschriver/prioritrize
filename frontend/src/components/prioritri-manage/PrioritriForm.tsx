import { useState, useEffect } from 'react';
import { useCreatePrioritri, useUpdatePrioritri } from '../../hooks/usePrioritris';
import type { Prioritri, PrioritriCreate } from '../../types';

interface PrioritriFormProps {
  editing?: Prioritri | null;
  onDone: () => void;
}

const GOAL_TYPE_ID = 1;
const BONUS_TYPE_ID = 2;

export function PrioritriForm({ editing, onDone }: PrioritriFormProps) {
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(GOAL_TYPE_ID);
  const [pointValue, setPointValue] = useState(10);
  const [canRepeat, setCanRepeat] = useState(false);
  const [timeblock, setTimeblock] = useState('');
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [extraPenalty, setExtraPenalty] = useState(0);
  const [error, setError] = useState('');

  const createPrioritri = useCreatePrioritri();
  const updatePrioritri = useUpdatePrioritri();

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setTypeId(editing.type_id);
      setPointValue(editing.point_value);
      setCanRepeat(editing.can_repeat);
      setTimeblock(editing.timeblock?.toString() || '');
      setCommentsEnabled(editing.comments_enabled);
      setExtraPenalty(editing.extra_penalty);
    }
  }, [editing]);

  const isBonus = typeId === BONUS_TYPE_ID;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const data: PrioritriCreate = {
      name,
      type_id: typeId,
      point_value: pointValue,
      can_repeat: canRepeat,
      timeblock: timeblock ? parseInt(timeblock) : null,
      comments_enabled: commentsEnabled,
      extra_penalty: isBonus ? 0 : extraPenalty,
    };

    try {
      if (editing) {
        await updatePrioritri.mutateAsync({ id: editing.id, data });
      } else {
        await createPrioritri.mutateAsync(data);
      }
      // Reset form
      setName('');
      setTypeId(GOAL_TYPE_ID);
      setPointValue(10);
      setCanRepeat(false);
      setTimeblock('');
      setCommentsEnabled(false);
      setExtraPenalty(0);
      onDone();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">
        {editing ? 'Edit Prioritri' : 'Add New Prioritri'}
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
          <label className="text-xs text-gray-500">Type</label>
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
            min={1}
            value={pointValue}
            onChange={e => setPointValue(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Timeblock (minutes)</label>
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
          <label className="text-xs text-gray-500">Extra Penalty</label>
          <input
            type="number"
            min={0}
            value={isBonus ? 0 : extraPenalty}
            onChange={e => setExtraPenalty(parseInt(e.target.value) || 0)}
            disabled={isBonus}
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
          disabled={createPrioritri.isPending || updatePrioritri.isPending}
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
