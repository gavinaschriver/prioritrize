import { useItemRefNav } from './itemRefNav';
import { useItemRef } from '../../hooks/useItemRef';
import { TodoDetailModal } from './TodoDetailModal';
import { TaskDetailModal } from './TaskDetailModal';
import { Modal } from './Modal';

/**
 * Mounted once, near the root. Turns whatever number the context is holding into
 * the right detail sheet — one host so a reference opens the same sheet whether
 * it was clicked from a daily note, a project overview or another task.
 */
export function ItemRefHost() {
  const nav = useItemRefNav();
  const { data, isLoading, isError } = useItemRef(nav?.openNumber ?? null);

  if (!nav?.openNumber) return null;

  if (isLoading) {
    return (
      <Modal open onClose={nav.close} title={`#${nav.openNumber}`}>
        <p className="text-sm text-gray-500">Loading…</p>
      </Modal>
    );
  }

  if (isError || !data) {
    return (
      <Modal open onClose={nav.close} title={`#${nav.openNumber}`}>
        <p className="text-sm text-gray-500">Nothing is numbered #{nav.openNumber}.</p>
      </Modal>
    );
  }

  if (data.entity_type === 'todo') {
    return <TodoDetailModal todoId={data.entity_id} onClose={nav.close} />;
  }
  // A task always has a parent; without one there's no project to load it from.
  if (!data.project_id) return null;
  return <TaskDetailModal projectId={data.project_id} taskId={data.entity_id} onClose={nav.close} />;
}
