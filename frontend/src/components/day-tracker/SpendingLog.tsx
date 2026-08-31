import { useState } from 'react';
import { EditableComment } from './EditableComment';
import { formatCurrency, AMOUNT_PATTERN } from './SpendingInput';
import { useSpending, useUpdateSpend, useDeleteSpend } from '../../hooks/useSpending';
import type { Spend } from '../../types';

/** Click-to-edit dollar amount, shaped like EditableComment. */
function EditableAmount({ value, onSave }: { value: string; onSave: (amount: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    const next = draft === '' || draft === '.' ? value : Number(draft).toFixed(2);
    if (Number(next) !== Number(value)) onSave(next);
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        autoFocus
        onChange={e => {
          if (AMOUNT_PATTERN.test(e.target.value)) setDraft(e.target.value);
        }}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className="w-20 text-right text-sm font-mono font-bold bg-gray-50 border border-gray-200 rounded px-1 outline-none focus:ring-1 focus:ring-blue-400"
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setIsEditing(true); }}
      title="Click to edit amount"
      className="text-sm font-mono font-bold text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1 transition-colors"
    >
      {formatCurrency(Number(value))}
    </span>
  );
}

function SpendRow({ item }: { item: Spend }) {
  const updateSpend = useUpdateSpend();
  const deleteSpend = useDeleteSpend();

  return (
    <div className="flex items-start justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
      <div className="flex-1 min-w-0">
        <EditableComment
          value={item.comment}
          onSave={comment => updateSpend.mutate({ spendId: item.id, data: { comment } })}
        />
      </div>
      <div className="shrink-0 ml-2">
        <EditableAmount
          value={item.amount}
          onSave={amount => updateSpend.mutate({ spendId: item.id, data: { amount } })}
        />
      </div>
      <button
        onClick={() => deleteSpend.mutate(item.id)}
        disabled={deleteSpend.isPending}
        className="shrink-0 ml-2 text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}

interface SpendingLogProps {
  selectedDate: string;
}

export function SpendingLog({ selectedDate }: SpendingLogProps) {
  const { data } = useSpending(selectedDate);

  const items = data?.items ?? [];
  const total = Number(data?.total ?? 0);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Spending
        </h3>
        <span className="text-sm font-bold font-mono text-gray-700">
          {formatCurrency(total)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">No spending logged.</p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map(item => <SpendRow key={item.id} item={item} />)}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-2">
            <span className="text-xs text-gray-500">Total Spent</span>
            <span className="text-sm font-bold font-mono text-gray-700">
              {formatCurrency(total)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
