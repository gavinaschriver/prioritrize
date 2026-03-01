import { useState } from 'react';
import { PrioritryForm } from '../components/prioritry-manage/PrioritryForm';
import { PrioritryList } from '../components/prioritry-manage/PrioritryList';
import type { Prioritry } from '../types';

export function ManagePrioritriesPage() {
  const [editing, setEditing] = useState<Prioritry | null>(null);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Manage PrioriTries</h2>
      <PrioritryForm editing={editing} onDone={() => setEditing(null)} />
      <PrioritryList onEdit={setEditing} />
    </div>
  );
}
