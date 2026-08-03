interface DailyScoreSummaryProps {
  score: number;
}

export function DailyScoreSummary({ score }: DailyScoreSummaryProps) {
  const color =
    score >= 0
      ? "text-green-700 bg-green-50 border-green-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className={`text-center py-3 rounded-lg border ${color} mb-6 mt-6`}>
      <span className="text-sm text-gray-600">Current Daily Score</span>
      <p className="text-xl font-bold">
        {score >= 0 ? "+" : ""}
        {score % 1 === 0 ? score : Number(score).toFixed(1)}
      </p>
    </div>
  );
}
