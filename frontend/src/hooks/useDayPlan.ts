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

/** Every block on the day, wherever it sits, as one list. */
const allBlocks = (plan: DayPlan) => [...plan.bank, ...plan.dailies, ...plan.slots, ...plan.dismissed];

/** Re-sort a flat list of blocks back into the three lists the page reads. */
function regroup(plan: DayPlan, blocks: PlanBlock[]): DayPlan {
  return {
    ...plan,
    bank: blocks.filter(b => b.section === 'bank' && b.entity_type !== 'prioritry'),
    dailies: blocks.filter(b => b.section === 'bank' && b.entity_type === 'prioritry'),
    slots: blocks.filter(b => b.section !== 'bank' && b.section !== 'dismissed'),
    dismissed: blocks.filter(b => b.section === 'dismissed'),
  };
}

/** The shared optimistic dance: snapshot, apply the change locally, roll back on
 *  error, and refetch either way so the server's version wins in the end. Same
 *  shape as useReorderProjects, pulled out because three mutations need it. */
function optimistic<Vars>(
  queryClient: QueryClient,
  date: string,
  apply: (blocks: PlanBlock[], vars: Vars) => PlanBlock[],
) {
  return {
    onMutate: async (vars: Vars) => {
      await queryClient.cancelQueries({ queryKey: planKey(date) });
      const previous = queryClient.getQueryData<DayPlan>(planKey(date));
      if (previous) {
        queryClient.setQueryData<DayPlan>(planKey(date), regroup(previous, apply(allBlocks(previous), vars)));
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
  /** Only needed for "+ Other" pulls, whose item isn't on the day yet. */
  name?: string;
}

/** Put something on the day: an item from the bank into a slot, a "+ Other" pick
 *  into the bank, or a new freeform block into a slot. */
export function usePlaceItem(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // `name` is only for the optimistic block, so it's left out of the request.
    mutationFn: ({ section, slot_index, entity_type, entity_id, freeform_text }: PlaceVars): Promise<{ id: string }> =>
      api.post('/api/day-plan/items', { plan_date: date, section, slot_index, entity_type, entity_id, freeform_text }),
    ...optimistic<PlaceVars>(queryClient, date, (blocks, vars) => {
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
        can_repeat: false,
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
      return [...others, placed];
    }),
  });
}

export interface MoveVars {
  id: string;
  section: PlanSection;
  slot_index: number | null;
}

/** Move a stored block. The server swaps it with whatever's in the target slot,
 *  and so does the optimistic update. */
export function useMoveItem(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...target }: MoveVars) => api.patch(`/api/day-plan/items/${id}/move`, target),
    ...optimistic<MoveVars>(queryClient, date, (blocks, vars) => {
      const mover = blocks.find(b => b.id === vars.id);
      if (!mover) return blocks;
      // Only timeline slots can be occupied; the bank and 'dismissed' are piles.
      const occupant = vars.slot_index === null
        ? undefined
        : blocks.find(b => b !== mover && b.section === vars.section && b.slot_index === vars.slot_index);
      return blocks.map(b => {
        if (b === mover) return { ...b, section: vars.section, slot_index: vars.slot_index };
        if (b === occupant) return { ...b, section: mover.section, slot_index: mover.slot_index };
        return b;
      });
    }),
  });
}

/** Take a stored block off the day. An item that's due that day will reappear
 *  in the bank on refetch, since the bank derives those. */
export function useRemoveItem(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/day-plan/items/${id}`),
    ...optimistic<string>(queryClient, date, (blocks, id) => blocks.filter(b => b.id !== id)),
  });
}

export function useUpdateFreeform(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.patch(`/api/day-plan/items/${id}/text`, { freeform_text: text }),
    // Optimistic too, or the card flashes "Untitled" between Enter and the refetch.
    ...optimistic<{ id: string; text: string }>(queryClient, date, (blocks, vars) =>
      blocks.map(b => (b.id === vars.id ? { ...b, name: vars.text } : b)),
    ),
  });
}

export interface RemoveSlotVars {
  section: TimelineSection;
  slot_index: number;
}

/** Close up an empty slot. Optimistic like the rest, but it changes the section's
 *  count as well as the blocks, so it doesn't fit the shared helper. */
export function useRemoveSlot(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: RemoveSlotVars) =>
      api.post('/api/day-plan/sections/remove-slot', { plan_date: date, ...vars }),
    onMutate: async (vars: RemoveSlotVars) => {
      await queryClient.cancelQueries({ queryKey: planKey(date) });
      const previous = queryClient.getQueryData<DayPlan>(planKey(date));
      if (previous) {
        queryClient.setQueryData<DayPlan>(planKey(date), {
          ...previous,
          // Everything below the removed slot steps up one.
          slots: previous.slots.map(b =>
            b.section === vars.section && b.slot_index !== null && b.slot_index > vars.slot_index
              ? { ...b, slot_index: b.slot_index - 1 }
              : b,
          ),
          slot_counts: { ...previous.slot_counts, [vars.section]: previous.slot_counts[vars.section] - 1 },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(planKey(date), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: planKey(date) });
    },
  });
}
