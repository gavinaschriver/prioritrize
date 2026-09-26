import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';
import type { DayPlan, PlanBlock, PlanCandidate, PlanEntityType, PlanSection, TimelineSection } from '../types';

const planKey = (date: string) => ['dayPlan', date];

export function useDayPlan(date: string) {
  const tz = getUserTimezone();
  return useQuery<DayPlan>({
    queryKey: planKey(date),
    queryFn: () => api.get(`/api/day-plan?date=${date}&tz=${encodeURIComponent(tz)}`),
  });
}

export function useDayPlanCandidates(date: string, enabled: boolean) {
  const tz = getUserTimezone();
  return useQuery<PlanCandidate[]>({
    queryKey: ['dayPlanCandidates', date],
    queryFn: () => api.get(`/api/day-plan/candidates?date=${date}&tz=${encodeURIComponent(tz)}`),
    // Only fetched while the "+ Other" picker is open.
    enabled,
  });
}

/** The parts of a day's plan an optimistic update can change: every block,
 *  wherever it sits, as one flat list -- plus how many slots each section has. */
interface Layout {
  blocks: PlanBlock[];
  counts: Record<TimelineSection, number>;
}

const isTimeline = (section: PlanSection): section is TimelineSection =>
  section === 'morning' || section === 'afternoon' || section === 'evening';

/** Re-sort a flat layout back into the lists the page reads. */
function regroup(plan: DayPlan, { blocks, counts }: Layout): DayPlan {
  return {
    ...plan,
    bank: blocks.filter(b => b.section === 'bank' && b.entity_type !== 'prioritry'),
    dailies: blocks.filter(b => b.section === 'bank' && b.entity_type === 'prioritry'),
    slots: blocks.filter(b => isTimeline(b.section)),
    dismissed: blocks.filter(b => b.section === 'dismissed'),
    slot_counts: counts,
  };
}

/** Local mirror of the server's _open_gap: slot_index and everything below step
 *  down one, and the section gains a slot. */
function openGap(layout: Layout, section: TimelineSection, slotIndex: number, excludeId?: string): Layout {
  return {
    blocks: layout.blocks.map(b =>
      b.section === section && b.id !== excludeId && b.slot_index !== null && b.slot_index >= slotIndex
        ? { ...b, slot_index: b.slot_index + 1 }
        : b,
    ),
    counts: { ...layout.counts, [section]: layout.counts[section] + 1 },
  };
}

/** Local mirror of _close_gap: slot_index goes away, everything below steps up. */
function closeGap(layout: Layout, section: TimelineSection, slotIndex: number, excludeId?: string): Layout {
  return {
    blocks: layout.blocks.map(b =>
      b.section === section && b.id !== excludeId && b.slot_index !== null && b.slot_index > slotIndex
        ? { ...b, slot_index: b.slot_index - 1 }
        : b,
    ),
    counts: { ...layout.counts, [section]: layout.counts[section] - 1 },
  };
}

/** The shared optimistic dance: snapshot, apply the change locally, roll back on
 *  error, and refetch either way so the server's version wins in the end. Same
 *  shape as useReorderProjects, pulled out because every mutation here needs it. */
function optimistic<Vars>(
  queryClient: QueryClient,
  date: string,
  apply: (layout: Layout, vars: Vars) => Layout,
) {
  return {
    onMutate: async (vars: Vars) => {
      await queryClient.cancelQueries({ queryKey: planKey(date) });
      const previous = queryClient.getQueryData<DayPlan>(planKey(date));
      if (previous) {
        const layout: Layout = {
          blocks: [...previous.bank, ...previous.dailies, ...previous.slots, ...previous.dismissed],
          counts: previous.slot_counts,
        };
        queryClient.setQueryData<DayPlan>(planKey(date), regroup(previous, apply(layout, vars)));
      }
      return { previous };
    },
    onError: (_err: unknown, _vars: Vars, context?: { previous?: DayPlan }) => {
      if (context?.previous) queryClient.setQueryData(planKey(date), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: planKey(date) });
      queryClient.invalidateQueries({ queryKey: ['dayPlanCandidates', date] });
    },
  };
}

export interface PlaceVars {
  section: PlanSection;
  slot_index: number | null;
  entity_type: PlanEntityType;
  entity_id: string | null;
  freeform_text?: string | null;
  /** Open a new slot at slot_index instead of taking it. */
  insert?: boolean;
  /** Only needed for "+ Other" pulls, whose item isn't on the day yet. */
  name?: string;
}

/** Put something on the day: an item from the bank into a slot, a "+ Other" pick
 *  into the bank, or a new freeform block into a slot. */
export function usePlaceItem(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // `name` is only for the optimistic block, so it's left out of the request.
    mutationFn: ({ section, slot_index, entity_type, entity_id, freeform_text, insert }: PlaceVars): Promise<{ id: string }> =>
      api.post('/api/day-plan/items', { plan_date: date, section, slot_index, entity_type, entity_id, freeform_text, insert }),
    ...optimistic<PlaceVars>(queryClient, date, (layout, vars) => {
      if (vars.insert && isTimeline(vars.section) && vars.slot_index !== null) {
        layout = openGap(layout, vars.section, vars.slot_index);
      }
      const { blocks } = layout;
      const matches = (b: PlanBlock) => b.entity_type === vars.entity_type && b.entity_id === vars.entity_id;
      // Prefer the unsaved copy -- for a repeatable daily that's the drawer one
      // being dragged, not a session already sitting in a slot.
      const existing = vars.entity_id
        ? blocks.find(b => matches(b) && b.id === null) ?? blocks.find(matches)
        : undefined;
      // A repeatable daily stays in its drawer, one session more scheduled.
      const staysInDrawer = existing?.can_repeat && existing.id === null;
      const others = !existing
        ? blocks
        : staysInDrawer
          ? blocks.map(b => (b === existing ? { ...b, scheduled_count: b.scheduled_count + 1 } : b))
          : blocks.filter(b => b !== existing);
      const placed: PlanBlock = {
        name: vars.freeform_text ?? vars.name ?? '',
        point_value: null, ref_number: null, due_date: null, completed_at: null,
        project_id: null, project_name: null, logged: false, daily_type: null,
        can_repeat: false, note: null, comments_enabled: false,
        ...existing,
        // A slotted session isn't "scheduled" itself; only the drawer copy counts.
        scheduled_count: 0,
        // A throwaway id until the refetch brings the real one. The "pending-"
        // prefix lets the page refuse to move a block the server hasn't saved yet.
        id: `pending-${crypto.randomUUID()}`,
        section: vars.section,
        slot_index: vars.slot_index,
        entity_type: vars.entity_type,
        entity_id: vars.entity_id,
      };
      return { ...layout, blocks: [...others, placed] };
    }),
  });
}

export interface MoveVars {
  id: string;
  section: PlanSection;
  slot_index: number | null;
  /** Open a new slot at the target and close the old one: a reorder, not a swap. */
  insert?: boolean;
  /** Leaving the timeline, close up the slot left behind. */
  collapse?: boolean;
}

/** Move a stored block: a swap onto a slot, an insert between slots, or back to
 *  the bank. The optimistic update mirrors whichever the server will do. */
export function useMoveItem(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...target }: MoveVars) => api.patch(`/api/day-plan/items/${id}/move`, target),
    ...optimistic<MoveVars>(queryClient, date, (layout, vars) => {
      const mover = layout.blocks.find(b => b.id === vars.id);
      if (!mover) return layout;
      const from = mover.section;
      const fromIndex = mover.slot_index;
      const place = (l: Layout, slotIndex: number | null): Layout => ({
        ...l,
        blocks: l.blocks.map(b => (b.id === vars.id ? { ...b, section: vars.section, slot_index: slotIndex } : b)),
      });

      if (vars.insert && isTimeline(vars.section) && vars.slot_index !== null) {
        let target = vars.slot_index;
        if (isTimeline(from) && fromIndex !== null) {
          layout = closeGap(layout, from, fromIndex, vars.id);
          if (from === vars.section && target > fromIndex) target -= 1;
        }
        return place(openGap(layout, vars.section, target, vars.id), target);
      }

      if (vars.collapse && isTimeline(from) && fromIndex !== null && !isTimeline(vars.section)) {
        return place(closeGap(layout, from, fromIndex, vars.id), vars.slot_index);
      }

      // Only timeline slots can be occupied; the bank and 'dismissed' are piles.
      const occupant = vars.slot_index === null
        ? undefined
        : layout.blocks.find(b => b !== mover && b.section === vars.section && b.slot_index === vars.slot_index);
      return {
        ...layout,
        blocks: layout.blocks.map(b => {
          if (b === mover) return { ...b, section: vars.section, slot_index: vars.slot_index };
          if (b === occupant) return { ...b, section: from, slot_index: fromIndex };
          return b;
        }),
      };
    }),
  });
}

export interface RemoveVars {
  id: string;
  /** Close up the slot it sat in, too. */
  collapse?: boolean;
}

/** Take a stored block off the day. An item that's due that day will reappear
 *  in the bank on refetch, since the bank derives those. */
export function useRemoveItem(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, collapse }: RemoveVars) =>
      api.delete(`/api/day-plan/items/${id}${collapse ? '?collapse=true' : ''}`),
    ...optimistic<RemoveVars>(queryClient, date, (layout, vars) => {
      const gone = layout.blocks.find(b => b.id === vars.id);
      const without = { ...layout, blocks: layout.blocks.filter(b => b.id !== vars.id) };
      return vars.collapse && gone && isTimeline(gone.section) && gone.slot_index !== null
        ? closeGap(without, gone.section, gone.slot_index)
        : without;
    }),
  });
}

export function useUpdateFreeform(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.patch(`/api/day-plan/items/${id}/text`, { freeform_text: text }),
    // Optimistic too, or the card flashes "Untitled" between Enter and the refetch.
    ...optimistic<{ id: string; text: string }>(queryClient, date, (layout, vars) => ({
      ...layout,
      blocks: layout.blocks.map(b => (b.id === vars.id ? { ...b, name: vars.text } : b)),
    })),
  });
}

/** Label a scheduled session with what it'll actually be. */
export function useUpdateNote(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.patch(`/api/day-plan/items/${id}/note`, { note }),
    ...optimistic<{ id: string; note: string }>(queryClient, date, (layout, vars) => ({
      ...layout,
      blocks: layout.blocks.map(b => (b.id === vars.id ? { ...b, note: vars.note.trim() || null } : b)),
    })),
  });
}

export interface RemoveSlotVars {
  section: TimelineSection;
  slot_index: number;
}

/** Close up an empty slot; everything below it steps up one. */
export function useRemoveSlot(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: RemoveSlotVars) =>
      api.post('/api/day-plan/sections/remove-slot', { plan_date: date, ...vars }),
    ...optimistic<RemoveSlotVars>(queryClient, date, (layout, vars) => closeGap(layout, vars.section, vars.slot_index)),
  });
}
