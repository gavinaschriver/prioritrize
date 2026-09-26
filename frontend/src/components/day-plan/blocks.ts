import type { PlanBlock, TimelineSection } from '../../types';

/** Where a drop landed. Bank drops have no slot; timeline drops do. `insert`
 *  marks the gap between slots: open a new slot there rather than take one. */
export type DropTarget =
  | { section: 'bank'; slot_index: null; insert?: false }
  | { section: TimelineSection; slot_index: number; insert?: boolean };

/** Stable across refetches: the stored row id if there is one, else the item itself. */
export const dragId = (b: PlanBlock) => b.id ?? `${b.entity_type}:${b.entity_id}`;

/** A block not yet saved has a throwaway id; moving it would send that id to the server. */
export const isPending = (b: PlanBlock) => b.id?.startsWith('pending-') ?? false;

/** What the Freeform button hands to a drag. It poses as an unsaved bank block,
 *  so dropping it runs the same path as placing a due item: no id means a new
 *  row. `name` only labels the drag overlay; the placed block starts out blank. */
export const NEW_FREEFORM: PlanBlock = {
  id: null,
  section: 'bank',
  slot_index: null,
  entity_type: 'freeform',
  entity_id: null,
  name: 'Freeform',
  point_value: null,
  ref_number: null,
  due_date: null,
  completed_at: null,
  project_id: null,
  project_name: null,
  logged: false,
  daily_type: null,
  can_repeat: false,
  scheduled_count: 0,
  note: null,
  comments_enabled: false,
};
