interface YesterdayPromptProps {
  onGoToYesterday: () => void;
}

export function YesterdayPrompt({ onGoToYesterday }: YesterdayPromptProps) {
  return (
    <button
      onClick={onGoToYesterday}
      className="w-full mb-4 py-2 px-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm hover:bg-amber-100 transition"
    >
      Click to wrap up yesterday's logging
    </button>
  );
}
