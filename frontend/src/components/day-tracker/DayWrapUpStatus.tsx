import { useDayWrapUp, useSetDayWrapUp } from '../../hooks/useDayWrapUp';

/** "✓ wrapped up" for a past day you've finished logging, with a way back out.
 *  The same server state that suppresses the nudge on today's view. */
export function DayWrapUpStatus({ date }: { date: string }) {
  const { data, isLoading } = useDayWrapUp(date);
  const setWrapUp = useSetDayWrapUp();

  if (isLoading) return null;

  const wrapped = !!data?.wrapped_up_at;

  return (
    <button
      onClick={() => setWrapUp.mutate({ date, wrapped: !wrapped })}
      disabled={setWrapUp.isPending}
      title={wrapped
        ? 'Reopen this day for logging'
        : 'Mark this day done logging — dismisses the nudge on all your devices'}
      className={`text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
        wrapped
          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
          : 'bg-white border-gray-200 text-gray-500 hover:text-gray-600'
      }`}
    >
      {wrapped ? '✓ wrapped up' : 'Mark wrapped up'}
    </button>
  );
}
