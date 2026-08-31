import { useEffect, useRef, useState } from 'react';

/**
 * Pointer-driven vertical reordering for a list of ids.
 *
 * Pointer events rather than HTML5 drag-and-drop so it works under a finger as
 * well as a mouse. While a drag is live the order is held locally and the list
 * reflows on every move; the committed order only goes to the server on release.
 */
export function useSortableList(
  ids: string[],
  onCommit: (ids: string[]) => void | Promise<unknown>,
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  // Pointer events can outpace a render, so the in-flight order lives in a ref
  // and `order` is only the copy the list renders from.
  const orderRef = useRef<string[] | null>(null);
  const baseRef = useRef<string[]>([]);
  const commitRef = useRef(onCommit);

  useEffect(() => {
    commitRef.current = onCommit;
  });

  const items = order ?? ids;

  const registerRow = (id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  };

  // Bound to the window, not the handle: reordering the list moves the handle's
  // DOM node, and a moved node loses pointer capture — which would strand the
  // drag after the very first swap.
  useEffect(() => {
    if (!dragId) return;

    const move = (e: PointerEvent) => {
      const current = orderRef.current;
      if (!current) return;

      // Measured against the *other* rows only. Including the dragged row makes
      // the slot it just landed in read as "passed", flipping it back every move.
      const others = current.filter(id => id !== dragId);
      let to = 0;
      for (const id of others) {
        const rect = rows.current.get(id)?.getBoundingClientRect();
        if (!rect || e.clientY <= rect.top + rect.height / 2) break;
        to++;
      }

      const next = [...others];
      next.splice(to, 0, dragId);
      if (next.every((v, i) => v === current[i])) return;
      orderRef.current = next;
      setOrder(next);
    };

    const finish = (commit: boolean) => {
      const next = orderRef.current;
      const base = baseRef.current;
      orderRef.current = null;
      setDragId(null);

      if (commit && next && next.some((v, i) => v !== base[i])) {
        // Held until the write settles so the row doesn't flash back to where it
        // started in the frame before the optimistic cache update lands.
        setOrder(next);
        Promise.resolve(commitRef.current(next))
          .catch(() => {}) // rollback is the mutation's job; just stop showing ours
          .finally(() => setOrder(null));
      } else {
        setOrder(null);
      }
    };

    const up = () => finish(true);
    const cancel = () => finish(false);

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragId]);

  const dragHandleProps = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      // Stops the press from selecting text or scrolling the page instead.
      e.preventDefault();
      baseRef.current = [...ids];
      orderRef.current = [...ids];
      setDragId(id);
      setOrder(orderRef.current);
    },
    // Without this a touch drag scrolls the page instead of moving the row.
    style: { touchAction: 'none' as const },
  });

  return { items, dragId, registerRow, dragHandleProps };
}
