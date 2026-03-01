import { useState } from 'react';

interface YesterdayPromptProps {
  onGoToYesterday: () => void;
}

export function YesterdayPrompt({ onGoToYesterday }: YesterdayPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative w-full mb-4">
      <button
        onClick={onGoToYesterday}
        className="w-full py-2 px-4 pr-10 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm hover:bg-amber-100 transition"
      >
        Click to wrap up yesterday's logging
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600 text-lg leading-none px-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
