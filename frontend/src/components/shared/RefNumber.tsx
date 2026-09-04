/** The item's own number, shown so you know what to type elsewhere to link it.
 *  Click copies it. */
export function RefNumber({ number, className = '' }: { number: number | null; className?: string }) {
  if (number == null) return null;
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard?.writeText(`#${number}`).catch(() => {});
      }}
      title={`Copy #${number} to reference this elsewhere`}
      className={`shrink-0 font-mono text-[11px] text-gray-500 hover:text-blue-600 ${className}`}
    >
      #{number}
    </button>
  );
}
