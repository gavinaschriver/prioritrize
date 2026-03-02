import { TodoForm } from '../components/prioritry-manage/TodoForm';
import { TodoList } from '../components/prioritry-manage/TodoList';

export function ManageTodosPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Manage Todos</h2>
      <TodoForm />
      <TodoList />
    </div>
  );
}
