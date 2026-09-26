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
