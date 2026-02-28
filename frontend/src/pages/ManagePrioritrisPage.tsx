import { useState } from 'react';
import { PrioritriForm } from '../components/prioritri-manage/PrioritriForm';
import { PrioritriList } from '../components/prioritri-manage/PrioritriList';
import type { Prioritri } from '../types';

export function ManagePrioritrisPage() {
  const [editing, setEditing] = useState<Prioritri | null>(null);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Manage Prioritris</h2>
      <PrioritriForm editing={editing} onDone={() => setEditing(null)} />
      <PrioritriList onEdit={setEditing} />
    </div>
  );
}
