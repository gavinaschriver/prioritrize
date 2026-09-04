import { useCategories } from '../../hooks/useCategories';

interface CategorySelectProps {
  /** '' means uncategorized. */
  value: string;
  onChange: (categoryId: string) => void;
  className?: string;
  /** Suppress the "add them on the Projects page" hint where it won't fit. */
  compact?: boolean;
}

/** The one category picker, shared by projects and todos so both offer the same
 *  evergreen list and neither drifts from the other. */
export function CategorySelect({ value, onChange, className = '', compact = false }: CategorySelectProps) {
  const { data: categories } = useCategories();

  return (
    <>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        title="Category"
        className={className || 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white'}
      >
        <option value="">— No category —</option>
        {categories?.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {!compact && !categories?.length && (
        <p className="text-xs text-gray-500 mt-1">
          No categories yet — add them at the bottom of the Projects page.
        </p>
      )}
    </>
  );
}

/** The assigned category as a chip, or nothing when uncategorized. */
export function CategoryChip({ categoryId, className = '' }: { categoryId: string | null; className?: string }) {
  const { data: categories } = useCategories();
  const category = categories?.find(c => c.id === categoryId);
  if (!category) return null;
  return (
    <span className={`text-xs text-gray-600 bg-gray-100 rounded px-1.5 py-px ${className}`}>
      {category.name}
    </span>
  );
}
