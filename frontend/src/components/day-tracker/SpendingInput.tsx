import { useState } from 'react';
import { TagCommentInput } from './TagCommentInput';
import { useCreateSpend } from '../../hooks/useSpending';

/** Dollars, always two places. Kept separate from formatScore, which is
 *  points-specific: it prefixes '+' and colors by sign. */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Allows intermediate states like '', '12.' and '12.5' while rejecting
 *  letters, a second dot, and a third decimal place. */
export const AMOUNT_PATTERN = /^\d*\.?\d{0,2}$/;

interface SpendingInputProps {
  selectedDate: string;
}

export function SpendingInput({ selectedDate }: SpendingInputProps) {
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const createSpend = useCreateSpend();

  const canAdd = amount !== '' && Number(amount) > 0 && !createSpend.isPending;

  const handleAdd = () => {
    if (!canAdd) return;
    createSpend.mutate({
      amount: Number(amount).toFixed(2),
      comment: comment.trim() || null,
      target_date: selectedDate,
    });
    setAmount('');
    setComment('');
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Spending:
        </span>
        <div className="flex items-center flex-1 px-2 py-1 border border-gray-200 rounded bg-white focus-within:ring-1 focus-within:ring-blue-400">
          <span className="text-sm text-gray-400 mr-1">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => {
              if (AMOUNT_PATTERN.test(e.target.value)) setAmount(e.target.value);
            }}
            onBlur={() => {
              if (amount !== '' && amount !== '.') setAmount(Number(amount).toFixed(2));
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="0.00"
            className="flex-1 min-w-0 text-sm font-mono bg-transparent outline-none"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg text-lg font-bold hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
      <TagCommentInput
        value={comment}
        onChange={setComment}
        onSubmit={handleAdd}
        placeholder="What was it for? #tag,"
      />
    </div>
  );
}
