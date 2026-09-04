import { useTodos, useUpdateTodo, useCompleteTodo, useUncompleteTodo, useDeleteTodo } from '../../hooks/useTodos';
import { Modal, ModalSection } from './Modal';
import { MarkdownField } from './MarkdownField';
import { Attachments } from './Attachments';
import { CoreFieldsEditor, type CoreFields } from './DetailFields';
import { ConvertTodoToTask } from './ConvertTodoToTask';
import { DueBadge } from './DueBadge';

/**
 * The Jira-ticket view of a todo: everything about it in one sheet, opened by
 * tapping the card anywhere it's listed. Reads the todo out of the shared list
 * cache so it stays live while the sheet is open.
 */
export function TodoDetailModal({
  todoId,
  onClose,
  viewedDate,
}: {
  todoId: string | null;
  onClose: () => void;
  /** Colours the due badge against the day being viewed, not always today. */
  viewedDate?: string;
}) {
  const { data: todos } = useTodos();
  const updateTodo = useUpdateTodo();
  const completeTodo = useCompleteTodo();
  const uncompleteTodo = useUncompleteTodo();
  const deleteTodo = useDeleteTodo();

  const todo = todos?.find(t => t.id === todoId);
  if (!todoId) return null;

  type TodoPatch = Partial<CoreFields> & { description?: string | null; comment?: string | null };
  const save = (data: TodoPatch) => updateTodo.mutateAsync({ id: todoId, data });

  return (
    <Modal
      open
      onClose={onClose}
      title={todo?.name ?? 'Todo'}
      subtitle={todo && (
        <div className="space-y-1">
          {!todo.completed_at && (
            <DueBadge dueDate={todo.due_date} viewedDate={viewedDate ?? new Date().toLocaleDateString('en-CA')} />
          )}
          <CoreFieldsEditor
            item={todo}
            onSave={save}
            showCategory
            saving={updateTodo.isPending}
          />
        </div>
      )}
      footer={todo && (
        <>
          {todo.completed_at ? (
            <button
              onClick={() => uncompleteTodo.mutate(todo.id)}
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              Reopen
            </button>
          ) : (
            <button
              onClick={() => { completeTodo.mutate(todo.id); onClose(); }}
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              ✓ Complete
            </button>
          )}
          <ConvertTodoToTask todoId={todo.id} />
          <button
            onClick={() => { deleteTodo.mutate(todo.id); onClose(); }}
            className="ml-auto rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </>
      )}
    >
      {!todo ? (
        <p className="text-sm text-gray-500">This todo is no longer in the list.</p>
      ) : (
        <>
          <ModalSection label="Description">
            <MarkdownField
              value={todo.description}
              onSave={description => save({ description })}
              placeholder="What to do, and notes on how"
              emptyLabel="Add a description..."
              rows={5}
            />
          </ModalSection>

          <ModalSection label="Comments">
            <MarkdownField
              value={todo.comment}
              onSave={comment => save({ comment })}
              placeholder="How did it go?"
              emptyLabel="Add a comment..."
            />
          </ModalSection>

          <ModalSection label="Files">
            <Attachments type="todo" id={todo.id} />
          </ModalSection>
        </>
      )}
    </Modal>
  );
}
