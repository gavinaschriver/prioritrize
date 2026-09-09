import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { CategoryChip } from '../shared/CategorySelect';
import { useTemplates, useInstantiateTemplate } from '../../hooks/useTemplates';
import type { ItemTemplate } from '../../types';

/** Pull a saved todo into the queue: pick one, give it a due date, done.
 *
 *  Follows ConvertTodoToTask's pattern of a button that swaps itself for an
 *  autofocused native select -- there is no dropdown primitive in this app, and a
 *  native select is the one control that behaves on a phone without any work.
 *
 *  Renders nothing at all until there is a template to add, so the toolbar stays
 *  as it was until the feature is actually in use. */
export function AddFromTemplate() {
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<ItemTemplate | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const { data: templates } = useTemplates('todo');
  const instantiate = useInstantiateTemplate();

  // Recurring ones are listed too, so an off-cycle "do the trash today" is one
  // click. Note this genuinely adds a second copy rather than moving the scheduled
  // one -- a recurring todo is already sitting in the queue, since it materializes
  // as soon as its schedule is saved.
  const available = templates ?? [];
  if (available.length === 0) return null;

  const confirm = async () => {
    if (!chosen) return;
    setError('');
    try {
      await instantiate.mutateAsync({ id: chosen.id, dueDate: dueDate || null });
      setChosen(null);
      setDueDate('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      {picking ? (
        <select
          autoFocus
          defaultValue=""
          onChange={e => {
            const found = available.find(t => t.id === e.target.value);
            if (found) { setChosen(found); setDueDate(''); }
            setPicking(false);
          }}
          onBlur={() => setPicking(false)}
          className="text-xs max-w-44 px-2 py-1 rounded-lg border bg-white border-gray-200 text-gray-600"
        >
          <option value="" disabled>Pick a template...</option>
          {available.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.repeat_every_days !== null ? ' (repeating)' : ''}
            </option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="text-xs px-2 py-1 rounded-lg border bg-white border-gray-200 text-gray-500 hover:text-gray-600 transition-colors"
          title="Add a saved todo to the queue"
        >
          + Template
        </button>
      )}

      <Modal
        open={chosen !== null}
        onClose={() => setChosen(null)}
        title={chosen?.name ?? ''}
        subtitle={
          chosen && (
            <span className="flex items-center gap-2 text-xs text-gray-500">
              <span>{chosen.point_value} pts</span>
              <CategoryChip categoryId={chosen.category_id} />
            </span>
          )
        }
        footer={
          <>
            <button
              onClick={confirm}
              disabled={instantiate.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {instantiate.isPending ? 'Adding...' : 'Add to queue'}
            </button>
            <button
              onClick={() => setChosen(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </>
        }
      >
        {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
        <label className="text-xs text-gray-500">Due Date <span className="text-gray-500">(optional)</span></label>
        <input
          type="date"
          autoFocus
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } }}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-2">
          Left blank it sits in the queue without a deadline, docking nothing.
        </p>
        {chosen?.description && (
          <p className="text-xs text-gray-500 mt-3 whitespace-pre-wrap">{chosen.description}</p>
        )}
      </Modal>
    </>
  );
}
