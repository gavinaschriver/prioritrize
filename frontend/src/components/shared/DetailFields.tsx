import { useState } from 'react';
import { CategorySelect, CategoryChip } from './CategorySelect';
import { formatDueDate } from '../../lib/urgency';

export interface CoreFields {
  name: string;
  point_value: number;
  due_date: string | null;
  category_id?: string | null;
}

/**
 * Title, points, due date and category for a detail sheet — read as a summary
 * line, edited as a form. This is the pencil that used to sit on the card.
 */
export function CoreFieldsEditor({
  item,
  onSave,
  showCategory = false,
  saving = false,
}: {
  item: CoreFields;
  onSave: (data: CoreFields) => Promise<unknown> | unknown;
  showCategory?: boolean;
  saving?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [pts, setPts] = useState(String(item.point_value));
  const [due, setDue] = useState(item.due_date ?? '');
  const [categoryId, setCategoryId] = useState(item.category_id ?? '');

  const open = () => {
    setName(item.name);
    setPts(String(item.point_value));
    setDue(item.due_date ?? '');
    setCategoryId(item.category_id ?? '');
    setEditing(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pts);
    await onSave({
      name,
      point_value: isNaN(parsed) ? 0 : parsed,
      due_date: due || null,
      ...(showCategory ? { category_id: categoryId || null } : {}),
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
        <span>{item.due_date ? `due ${formatDueDate(item.due_date)}` : 'no due date'}</span>
        <span>{item.point_value} pts</span>
        {showCategory && (item.category_id
          ? <CategoryChip categoryId={item.category_id} />
          : <span className="italic text-gray-500">uncategorized</span>)}
        <button onClick={open} className="text-xs text-blue-600 hover:underline" title="Edit title, points, due date">
          ✎ edit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div>
        <label className="text-xs text-gray-500">Title</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Points</label>
          <input
            type="number" min={0} value={pts} onChange={e => setPts(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">Due date</label>
          <input
            type="date" value={due} onChange={e => setDue(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      </div>
      {showCategory && (
        <div>
          <label className="text-xs text-gray-500">Category</label>
          <CategorySelect value={categoryId} onChange={setCategoryId} compact />
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
