import { useActiveItem, useSetActiveItem, useClearActiveItem } from '../../hooks/useActiveItem';
import type { ActiveEntityType } from '../../types';

/**
 * Puts this item in the bullpen, or takes it back out. Only one thing can be in
 * progress at a time, so activating anything swaps out whatever was there.
 */
export function ActivateButton({
  type,
  id,
  className = '',
}: {
  type: ActiveEntityType;
  id: string;
  className?: string;
}) {
  const { data: active } = useActiveItem();
  const setActive = useSetActiveItem();
  const clearActive = useClearActiveItem();

  const isActive = active?.entity_type === type && active.entity_id === id;
  const pending = setActive.isPending || clearActive.isPending;

  return (
    <button
      onClick={e => {
        // These sit on cards that open a detail sheet when tapped.
        e.stopPropagation();
        if (isActive) clearActive.mutate();
        else setActive.mutate({ entity_type: type, entity_id: id });
      }}
      disabled={pending}
      title={isActive ? 'Clear the bullpen' : 'Make this the thing you are working on'}
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide disabled:opacity-50 ${
        isActive
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'border border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600'
      } ${className}`}
    >
      {isActive ? 'De-activate' : 'Activate'}
    </button>
  );
}
