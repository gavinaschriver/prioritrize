import { useDayWrapUp, useSetDayWrapUp } from '../../hooks/useDayWrapUp';

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

interface YesterdayPromptProps {
  onGoToYesterday: () => void;
}

/** Nudge to finish logging yesterday, shown on today's view.
 *
 *  Dismissing marks yesterday wrapped up on the server, so it stays dismissed on
 *  every device instead of having to be cleared once per browser. */
export function YesterdayPrompt({ onGoToYesterday }: YesterdayPromptProps) {
  const yesterdayStr = getYesterdayStr();
  const { data, isLoading } = useDayWrapUp(yesterdayStr);
  const setWrapUp = useSetDayWrapUp();

  // Stay quiet until the answer is known — better than flashing a banner that a
  // response half a second later reveals was already dismissed on another device.
  if (isLoading || data?.wrapped_up_at) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWrapUp.mutate({ date: yesterdayStr, wrapped: true });
  };

  return (
    <div className="relative w-full mb-4">
      <button
        onClick={onGoToYesterday}
        className="w-full py-2 px-4 pr-10 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm hover:bg-amber-100 transition"
      >
        Click to wrap up yesterday's logging
      </button>
      <button
        onClick={handleDismiss}
        disabled={setWrapUp.isPending}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600 disabled:opacity-40 text-lg leading-none px-1"
        aria-label="Mark yesterday wrapped up"
        title="Mark yesterday wrapped up — dismisses on all your devices"
      >
        ×
      </button>
    </div>
  );
}
