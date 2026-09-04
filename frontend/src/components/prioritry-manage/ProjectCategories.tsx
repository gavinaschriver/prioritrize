import { useState } from 'react';
import {
  useProjectCategories, useCreateProjectCategory,
  useRenameProjectCategory, useDeleteProjectCategory,
} from '../../hooks/useProjectCategories';
import type { ProjectCategory } from '../../types';

function CategoryRow({ category }: { category: ProjectCategory }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState('');
  const rename = useRenameProjectCategory();
  const remove = useDeleteProjectCategory();

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || name.trim() === category.name) {
      setEditing(false);
      setName(category.name);
      return;
    }
    try {
      await rename.mutateAsync({ id: category.id, name: name.trim() });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (editing) {
    return (
      <form onSubmit={handleRename} className="flex items-center gap-2 px-2 sm:px-4 py-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          required
          className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded"
        />
        <button type="submit" disabled={rename.isPending}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50 shrink-0">Save</button>
        <button type="button" onClick={() => { setName(category.name); setError(''); setEditing(false); }}
          className="text-xs text-gray-500 hover:underline shrink-0">Cancel</button>
        {error && <span className="text-xs text-red-600 basis-full">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 sm:px-4 py-2">
      <span className="flex-1 min-w-0 text-sm text-gray-800">{category.name}</span>
      <span className="text-xs text-gray-500 shrink-0">
        {category.project_count} {category.project_count === 1 ? 'project' : 'projects'}
      </span>
      <button onClick={() => setEditing(true)}
        className="text-gray-500 hover:text-blue-500 text-sm shrink-0" title="Rename">✎</button>
      <button
        onClick={() => remove.mutate(category.id)}
        disabled={remove.isPending}
        title={category.project_count > 0
          ? `Delete — the ${category.project_count} project(s) here stay, just uncategorized`
          : 'Delete'}
        className="text-xs text-red-500 hover:underline disabled:opacity-50 shrink-0"
      >
        Delete
      </button>
    </div>
  );
}

/** Categories are the evergreen parent epics ("Carpentry", "Vehicle Work") that
 *  individual projects ("Utility Shelf", "Install L-track") get filed under.
 *  They're managed here and assigned from each project's own page. */
export function ProjectCategories() {
  const { data: categories, isLoading } = useProjectCategories();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const createCategory = useCreateProjectCategory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return;
    try {
      await createCategory.mutateAsync({ name: name.trim() });
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-2 sm:px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Categories</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Broad, evergreen buckets — assign one to a project from its own page.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
          <input
            type="text"
            placeholder="Add a category (e.g. Carpentry)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={createCategory.isPending || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </form>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm px-2 sm:px-4 py-3">Loading...</p>
      ) : !categories?.length ? (
        <p className="text-gray-500 text-sm px-2 sm:px-4 py-3">No categories yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {categories.map(c => <CategoryRow key={c.id} category={c} />)}
        </div>
      )}
    </div>
  );
}
