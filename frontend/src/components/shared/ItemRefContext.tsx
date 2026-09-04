import { useState, useCallback } from 'react';
import { ItemRefCtx } from './itemRefNav';

/**
 * Lets a "#1042" anywhere in any markdown body open that item's detail sheet.
 *
 * Held in context rather than passed down because the renderer is used in
 * dozens of places — daily notes, a project overview, another task's comment —
 * and none of them know or care what they're linking to.
 */
export function ItemRefProvider({ children }: { children: React.ReactNode }) {
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const open = useCallback((n: number) => setOpenNumber(n), []);
  const close = useCallback(() => setOpenNumber(null), []);
  return (
    <ItemRefCtx.Provider value={{ open, openNumber, close }}>
      {children}
    </ItemRefCtx.Provider>
  );
}
