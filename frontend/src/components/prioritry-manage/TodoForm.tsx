import { useState } from 'react';
import { CategorySelect } from '../shared/CategorySelect';
import { useCreateTodo } from '../../hooks/useTodos';
import { TagCommentInput } from '../day-tracker/TagCommentInput';

export function TodoForm() {
  const [name, setName] = useState('');
  const [pointValue, setPointValue] = useState('5');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');

  const createTodo = useCreateTodo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseInt(pointValue);
    if (isNaN(parsed) || parsed < 0) {
      setError('Point value must be 0 or greater');
      return;
    }

    try {
      await createTodo.mutateAsync({
        name,
        point_value: parsed,
        due_date: dueDate || null,
        description: description.trim() || null,
        category_id: categoryId || null,
      });
      setName('');
      setPointValue('5');
      setDueDate('');
      setDescription('');
      // categoryId deliberately survives: todos get added in runs, and a run is
      // usually all the same category.
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Add New Todo</h3>
      {error && <p className="text-red-600 text-xs">{error}</p>}

      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

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
        <div className="flex-1">
          <label className="text-xs text-gray-500">Due Date <span className="text-gray-500">(optional)</span></label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
      </div>

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
        disabled={createTodo.isPending}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        Add Todo
      </button>
    </form>
  );
}
