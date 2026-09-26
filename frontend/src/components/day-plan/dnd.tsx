import type { ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { dragId, isPending, type DropTarget } from './blocks';
import type { PlanBlock } from '../../types';

export function DraggableBlock({ block, className, children }: { block: PlanBlock; className?: string; children: ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: dragId(block),
    data: { block },
    disabled: isPending(block),
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // Leaves a ghost where it came from; the DragOverlay is what follows the finger.
      className={`touch-manipulation ${className ?? ''} ${isDragging ? 'opacity-30' : ''} ${isPending(block) ? 'cursor-wait' : 'cursor-grab'}`}
    >
      {children}
    </div>
  );
}

/** The strip between two slots. Hovering it draws an insertion line; dropping
 *  opens a new slot right there. */
export function GapZone({ id, target }: { id: string; target: DropTarget }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { target } });
  return (
    <div ref={setNodeRef} className="relative h-2.5">
      {isOver && <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-blue-500" />}
    </div>
  );
}

export function DropZone({ id, target, className, children }: {
  id: string;
  target: DropTarget;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { target } });
  return (
    <div ref={setNodeRef} className={`${className ?? ''} ${isOver ? 'ring-2 ring-blue-400 ring-offset-1 rounded-md' : ''}`}>
      {children}
    </div>
  );
}
