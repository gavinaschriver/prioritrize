import { ProjectForm } from '../components/prioritry-manage/ProjectForm';
import { ProjectList } from '../components/prioritry-manage/ProjectList';
import { ProjectCategories } from '../components/prioritry-manage/ProjectCategories';

export function ManageProjectsPage() {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">Projects</h2>
      <div className="space-y-6">
        <ProjectForm />
        <ProjectList />
        <ProjectCategories />
      </div>
    </div>
  );
}
