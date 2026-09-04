import { createContext, useContext } from 'react';

export interface ItemRefNav {
  /** Open the detail sheet for the item carrying this number. */
  open: (number: number) => void;
  openNumber: number | null;
  close: () => void;
}

export const ItemRefCtx = createContext<ItemRefNav | null>(null);

/** Null outside the provider, so the markdown renderer degrades to plain text
 *  rather than throwing if it's ever mounted somewhere without one. */
export function useItemRefNav() {
  return useContext(ItemRefCtx);
}
