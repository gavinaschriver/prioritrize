export function formatScore(value: number): string {
  const body = value % 1 === 0 ? String(value) : Number(value).toFixed(1);
  return value >= 0 ? `+${body}` : body;
}

interface SectionSubtotalProps {
  label: string;
  value: number;
}

/** Footer line closing out a section: label on the left, score on the right. */
export function SectionSubtotal({ label, value }: SectionSubtotalProps) {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold font-mono ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatScore(value)}
      </span>
    </div>
  );
}
