import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { getTodayStr } from "../lib/api";
import { DateNavigator } from "../components/day-tracker/DateNavigator";
import {
  useDayPlan,
  usePlaceItem,
  useMoveItem,
  useRemoveItem,
  useUpdateFreeform,
  useRemoveSlot,
} from "../hooks/useDayPlan";
import { DueBank } from "../components/day-plan/DueBank";
import { DailiesPanel } from "../components/day-plan/DailiesPanel";
import { TimelineSection } from "../components/day-plan/TimelineSection";
import { PlanBlockCard } from "../components/day-plan/PlanBlockCard";
import { OtherPicker } from "../components/day-plan/OtherPicker";
import { PlanBlockSheet } from "../components/day-plan/PlanBlockSheet";
import { SECTIONS } from "../components/day-plan/sections";
import { isPending, type DropTarget } from "../components/day-plan/blocks";
import type { PlanBlock } from "../types";

/** Arrange a day: pull due work out of the bank and into Morning / Afternoon /
 *  Evening slots. The date lives in the URL so a planned Sunday can be linked. */
export function DayPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get("date") ?? getTodayStr();
  const isToday = selectedDate === getTodayStr();
  const { data: plan, isLoading, error } = useDayPlan(selectedDate);

  const placeItem = usePlaceItem(selectedDate);
  const moveItem = useMoveItem(selectedDate);
  const removeItem = useRemoveItem(selectedDate);
  const updateFreeform = useUpdateFreeform(selectedDate);
  const removeSlot = useRemoveSlot(selectedDate);

  const [dragging, setDragging] = useState<PlanBlock | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [openBlock, setOpenBlock] = useState<PlanBlock | null>(null);
  const queryClient = useQueryClient();
  const isFuture = selectedDate > getTodayStr();

  // Mouse: a 5px nudge starts a drag, so a plain click still clicks.
  // Touch: press and hold 200ms. Anything quicker is a scroll, not a grab.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const changeDate = (date: string) => {
    // Today is the default, so it doesn't need to clutter the URL.
    setSearchParams(date === getTodayStr() ? {} : { date });
  };

  const openSheet = (block: PlanBlock) => {
    // Freeform blocks edit in place. A daily's sheet logs entries, and a day
    // that hasn't happened yet has nothing to log.
    if (block.entity_type === "freeform") return;
    if (block.entity_type === "prioritry" && isFuture) return;
    setOpenBlock(block);
  };

  /** A pulled-in item leaves the day entirely. */
  const removeFromDay = (block: PlanBlock) => {
    if (block.id) removeItem.mutate(block.id);
  };

  /** The × on a slotted block: send it back where it came from. */
  const clearToBank = (block: PlanBlock) => {
    if (!block.id) return;
    if (block.entity_type === "prioritry") {
      // Dailies are in their drawer by derivation, so dropping the row is enough.
      removeItem.mutate(block.id);
    } else {
      // Keep the row: a "+ Other" pull should land back in Due Today, not vanish.
      moveItem.mutate({ id: block.id, section: "bank", slot_index: null });
    }
  };

  /** Everything on the day that currently sits in a given slot, if anything. */
  const occupantOf = (target: DropTarget) =>
    target.section === "bank"
      ? undefined
      : plan?.slots.find(
          (b) =>
            b.section === target.section && b.slot_index === target.slot_index,
        );

  /** Decide what a drop means and fire the matching mutation.
   *
   *  `block.id` is null when the block is in the bank only because it's due today
   *  (nothing stored yet), and a real id once it has a row -- in a slot, or pulled
   *  into the bank via "+ Other".
   *
   *  Available:
   *    placeItem.mutate({ section, slot_index, entity_type, entity_id })  -> new row;
   *        the server answers 409 if that slot is taken
   *    moveItem.mutate({ id, section, slot_index })  -> moves a stored row; if the
   *        target slot is taken, the two blocks swap
   *    removeItem.mutate(id)  -> deletes a stored row. A block that's due today
   *        reappears in the bank; anything else leaves the day entirely.
   *    occupantOf(target)  -> the block already in that slot, if any
   */
  const handleDrop = (block: PlanBlock, target: DropTarget) => {
    const occupant = occupantOf(target);

    if (target.section === "bank") {
      // Derived bank blocks can only start in the bank, so this is always a stored row.
      if (!block.id) return;
      // Freeform blocks have no life outside a slot; the server rejects them in the bank.
      if (block.entity_type === "freeform") removeItem.mutate(block.id);
      else moveItem.mutate({ id: block.id, section: "bank", slot_index: null });
      return;
    }

    // A freeform occupant would be pushed into the bank, which the server refuses.
    const wouldBankFreeform =
      block.section === "bank" && occupant?.entity_type === "freeform";
    if (wouldBankFreeform) return;

    if (block.id) {
      moveItem.mutate({
        id: block.id,
        section: target.section,
        slot_index: target.slot_index,
      });
      return;
    }

    const place = () =>
      placeItem.mutate({
        section: target.section,
        slot_index: target.slot_index,
        entity_type: block.entity_type,
        entity_id: block.entity_id,
      });
    if (!occupant) return place();
    if (!occupant.id || isPending(occupant)) return;
    // No row to swap yet, so bump the occupant to the bank first, then take its slot.
    moveItem.mutate(
      { id: occupant.id, section: "bank", slot_index: null },
      { onSuccess: place },
    );
  };

  const onDragStart = (event: DragStartEvent) => {
    setDragging(event.active.data.current?.block ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const block: PlanBlock | undefined = event.active.data.current?.block;
    const target: DropTarget | undefined = event.over?.data.current?.target;
    // Released over nothing: leave everything where it was.
    if (!block || !target) return;
    // Dailies live in their own panel, not among the day's due work.
    if (target.section === "bank" && block.entity_type === "prioritry") return;
    // Dropped back where it started.
    if (
      block.section === target.section &&
      block.slot_index === target.slot_index
    )
      return;
    handleDrop(block, target);
  };

  return (
    <div>
      <DateNavigator
        selectedDate={selectedDate}
        onDateChange={changeDate}
        allowFuture
      />
      {isLoading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {plan && (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <DueBank
            bank={plan.bank}
            viewedDate={selectedDate}
            isToday={isToday}
            onOpenOther={() => setOtherOpen(true)}
            onOpen={openSheet}
            onRemove={removeFromDay}
          />
          <DailiesPanel
            dailies={plan.dailies}
            dismissed={plan.dismissed}
            viewedDate={selectedDate}
            onOpen={openSheet}
            onRestore={removeFromDay}
          />
          <div className="rounded-lg border border-gray-200 bg-white border-t-0">
            {SECTIONS.map((s) => (
              <TimelineSection
                key={s.key}
                section={s.key}
                label={s.label}
                start={s.start}
                end={s.end}
                blocks={plan.slots.filter((b) => b.section === s.key)}
                slotCount={plan.slot_counts[s.key]}
                viewedDate={selectedDate}
                onOpen={openSheet}
                onSaveFreeform={(block, text) =>
                  block.id && updateFreeform.mutate({ id: block.id, text })
                }
                onRemove={removeFromDay}
                onClear={clearToBank}
                onRemoveSlot={(slotIndex) =>
                  removeSlot.mutate({ section: s.key, slot_index: slotIndex })
                }
              />
            ))}
          </div>
          {/* Rendered at the top level so the dragged block floats over everything
              instead of being clipped by the bank's or the timeline's box. */}
          <DragOverlay>
            {dragging && (
              <div className="rotate-1 shadow-lg">
                <PlanBlockCard block={dragging} viewedDate={selectedDate} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
      <OtherPicker
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
        viewedDate={selectedDate}
      />
      <PlanBlockSheet
        block={openBlock}
        viewedDate={selectedDate}
        onClose={() => {
          setOpenBlock(null);
          // The sheet's own mutations (complete, rename, re-date) refresh the
          // tracker's queries, not this one.
          queryClient.invalidateQueries({ queryKey: ["dayPlan", selectedDate] });
        }}
      />
    </div>
  );
}
