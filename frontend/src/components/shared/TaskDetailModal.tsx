import {
  useProject, useUpdateProjectTask, useCompleteProjectTask,
  useUncompleteProjectTask, useDeleteProjectTask,
} from '../../hooks/useProjects';
import { Modal, ModalSection } from './Modal';
import { MarkdownField } from './MarkdownField';
import { Attachments } from './Attachments';
import { CoreFieldsEditor, type CoreFields } from './DetailFields';
import { ConvertTaskToTodo } from './ConvertTaskToTodo';
import { DueBadge } from './DueBadge';

/** The detail sheet for a project task, opened from a project page or the tracker. */
export function TaskDetailModal({
  projectId,
  taskId,
  onClose,
  viewedDate,
}: {
  projectId: string;
  taskId: string | null;
  onClose: () => void;
  viewedDate?: string;
}) {
  const { data: project } = useProject(projectId);
  const updateTask = useUpdateProjectTask(projectId);
  const completeTask = useCompleteProjectTask(projectId);
  const uncompleteTask = useUncompleteProjectTask(projectId);
  const deleteTask = useDeleteProjectTask(projectId);

  const task = project?.tasks.find(t => t.id === taskId);
  if (!taskId) return null;

  type TaskPatch = Partial<CoreFields> & { description?: string | null; comment?: string | null };
  const save = (data: TaskPatch) => updateTask.mutateAsync({ taskId, data });

  return (
    <Modal
      open
      onClose={onClose}
      title={task?.name ?? 'Task'}
      subtitle={task && (
        <div className="space-y-1">
          {project && <div className="text-xs text-gray-500">in {project.name}</div>}
          {!task.completed_at && (
            <DueBadge dueDate={task.due_date} viewedDate={viewedDate ?? new Date().toLocaleDateString('en-CA')} />
          )}
          <CoreFieldsEditor item={task} onSave={save} saving={updateTask.isPending} />
        </div>
      )}
      footer={task && (
        <>
          {task.completed_at ? (
            <button
              onClick={() => uncompleteTask.mutate(task.id)}
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              Reopen
            </button>
          ) : (
            <button
              onClick={() => { completeTask.mutate(task.id); onClose(); }}
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              ✓ Complete
            </button>
          )}
          <ConvertTaskToTodo projectId={projectId} taskId={task.id} />
          <button
            onClick={() => { deleteTask.mutate(task.id); onClose(); }}
            className="ml-auto rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </>
      )}
    >
      {!task ? (
        <p className="text-sm text-gray-500">This task is no longer on the project.</p>
      ) : (
        <>
          <ModalSection label="Description">
            <MarkdownField
              value={task.description}
              onSave={description => save({ description })}
              placeholder="What to do, and notes on how"
              emptyLabel="Add a description..."
              rows={5}
            />
          </ModalSection>

          <ModalSection label="Comments">
            <MarkdownField
              value={task.comment}
              onSave={comment => save({ comment })}
              placeholder="How did it go?"
              emptyLabel="Add a comment..."
            />
          </ModalSection>

          <ModalSection label="Files">
            <Attachments type="project_task" id={task.id} />
          </ModalSection>
        </>
      )}
    </Modal>
  );
}
