import { useState } from 'react';

const STORAGE_KEY = 'ypt_dismissed';

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

interface YesterdayPromptProps {
  onGoToYesterday: () => void;
}

export function YesterdayPrompt({ onGoToYesterday }: YesterdayPromptProps) {
  const yesterdayStr = getYesterdayStr();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === yesterdayStr
  );

  if (dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, yesterdayStr);
    setDismissed(true);
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
        className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600 text-lg leading-none px-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
