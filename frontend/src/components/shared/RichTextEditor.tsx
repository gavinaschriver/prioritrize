import { useRef, useEffect } from 'react';

/**
 * The markdown a toolbar button writes. Inline styles wrap the selection; block
 * styles prefix each selected line.
 */
type Wrap = { kind: 'wrap'; before: string; after: string };
type Block = { kind: 'block'; prefix: string };
type Action = Wrap | Block;

interface Control {
  label: string;
  title: string;
  className: string;
  action: Action;
}

const CONTROLS: Control[] = [
  { label: 'B', title: 'Bold', className: 'font-bold', action: { kind: 'wrap', before: '**', after: '**' } },
  { label: 'I', title: 'Italic', className: 'italic', action: { kind: 'wrap', before: '_', after: '_' } },
  // Markdown has no underline; the renderer allows a sanitised <u> for exactly this.
  { label: 'U', title: 'Underline', className: 'underline', action: { kind: 'wrap', before: '<u>', after: '</u>' } },
  { label: 'S', title: 'Strikethrough', className: 'line-through', action: { kind: 'wrap', before: '~~', after: '~~' } },
  { label: '•', title: 'Bullet list', className: '', action: { kind: 'block', prefix: '- ' } },
  { label: '☑', title: 'Checklist', className: '', action: { kind: 'block', prefix: '- [ ] ' } },
];

/** Strip whichever block prefix a line already carries, so the buttons toggle. */
const BLOCK_PREFIX = /^(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+)/;

function applyWrap(value: string, start: number, end: number, { before, after }: Wrap) {
  const selected = value.slice(start, end);
  // Clicking the same button again with the wrapper still selected removes it.
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return { text: value.slice(0, start) + inner + value.slice(end), from: start, to: start + inner.length };
  }
  const wrapped = before + selected + after;
  return {
    text: value.slice(0, start) + wrapped + value.slice(end),
    // With nothing selected, drop the caret between the markers so typing lands inside.
    from: selected ? start : start + before.length,
    to: selected ? start + wrapped.length : start + before.length,
  };
}

function applyBlock(value: string, start: number, end: number, { prefix }: Block) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = value.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const lines = value.slice(lineStart, lineEnd).split('\n');

  const bareOf = (line: string) => line.replace(/^\s*/, '');
  // Which block marker a line already has. Compared by kind rather than by raw
  // prefix so a checked "- [x] " still reads as a checklist item, and so hitting
  // the bullet button on a checklist converts it instead of stripping it bare.
  const kindOf = (line: string) => {
    const bare = bareOf(line);
    if (/^[-*+]\s+\[[ xX]\]\s+/.test(bare)) return 'check';
    if (/^[-*+]\s+/.test(bare)) return 'bullet';
    return 'none';
  };
  const wanted = prefix.includes('[') ? 'check' : 'bullet';
  // Blank lines don't vote: a selection of "- a\n\n- b" still counts as all bulleted.
  const allPrefixed = lines.every(l => l.trim() === '' || kindOf(l) === wanted);

  const next = lines
    .map(line => {
      if (line.trim() === '') return line;
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const bare = bareOf(line).replace(BLOCK_PREFIX, '');
      return allPrefixed ? indent + bare : indent + prefix + bare;
    })
    .join('\n');

  return {
    text: value.slice(0, lineStart) + next + value.slice(lineEnd),
    from: lineStart,
    to: lineStart + next.length,
  };
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  onBlur?: () => void;
  /** Escape reverts and closes, where the caller supports it. */
  onEscape?: () => void;
  /** Cmd/Ctrl+Enter commits, where the caller supports it. */
  onSubmit?: () => void;
}

/**
 * A markdown textarea with real formatting buttons, so bold and checklists are
 * a click rather than remembered punctuation. It still stores plain markdown --
 * the buttons write the same characters you could type by hand, and the same
 * renderer displays it.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  autoFocus,
  className = '',
  onBlur,
  onEscape,
  onSubmit,
}: RichTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const pendingRange = useRef<{ from: number; to: number } | null>(null);

  // Grow with the content so a long body isn't written through a porthole.
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  // Restore the selection after the parent re-renders with the new text, so the
  // words you just bolded stay selected and the caret doesn't jump to the end.
  useEffect(() => {
    const range = pendingRange.current;
    if (range && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(range.from, range.to);
      pendingRange.current = null;
    }
  }, [value]);

  const apply = (action: Action) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const result = action.kind === 'wrap'
      ? applyWrap(value, start, end, action)
      : applyBlock(value, start, end, action);
    pendingRange.current = { from: result.from, to: result.to };
    onChange(result.text);
  };

  return (
    <div className={`rounded-lg border border-gray-300 bg-white overflow-hidden ${className}`}>
      <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1 py-1">
        {CONTROLS.map(c => (
          <button
            key={c.label}
            type="button"
            title={c.title}
            aria-label={c.title}
            // The textarea must keep focus, or there'd be no selection to format.
            onMouseDown={e => e.preventDefault()}
            onClick={() => apply(c.action)}
            className={`w-7 h-7 flex items-center justify-center rounded text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-800 ${c.className}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={e => {
          if (e.key === 'Escape' && onEscape) {
            e.preventDefault();
            onEscape();
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full resize-none px-3 py-2 text-sm outline-none"
      />
    </div>
  );
}
