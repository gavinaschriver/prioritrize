import { useRef, useEffect, useState } from 'react';
import { useTags } from '../../hooks/useTags';
import type { TagSuggestion } from '../../types';

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

  // Blank lines don't vote, or a selection spanning a gap could never toggle off.
  // With nothing but blank lines there is no marker to remove, so this is an add --
  // which is the ordinary case: open an empty field, click the button, start typing.
  const written = lines.filter(l => l.trim() !== '');
  const adding = written.length === 0 || !written.every(l => kindOf(l) === wanted);

  const next = lines
    .map(line => {
      // A blank separator inside a real selection stays blank; a wholly empty
      // field gets the marker so there is something to type after.
      if (line.trim() === '' && written.length > 0) return line;
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const bare = bareOf(line).replace(BLOCK_PREFIX, '');
      return adding ? indent + prefix + bare : indent + bare;
    })
    .join('\n');

  // A caret stays a caret, parked after the marker so typing continues the line.
  // Selecting the rewritten range instead would mean the next keystroke replaced it.
  const collapsed = start === end;
  return {
    text: value.slice(0, lineStart) + next + value.slice(lineEnd),
    from: collapsed ? lineStart + next.length : lineStart,
    to: lineStart + next.length,
  };
}

/**
 * A line that is already a list item: its indent, its marker, and whatever it
 * says. Covers bullets, checkboxes (either state) and numbered items.
 */
const LIST_LINE = /^(\s*)([-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)(.*)$/;

/** The marker the *next* line should get: a checkbox always starts unchecked,
 *  and a numbered item counts on. */
function nextMarker(marker: string): string {
  const numbered = /^(\d+)([.)][ \t]+)$/.exec(marker);
  if (numbered) return `${Number(numbered[1]) + 1}${numbered[2]}`;
  return marker.replace(/\[[xX]\]/, '[ ]');
}

/**
 * Enter inside a list. Returns the rewritten body and where the caret lands, or
 * null to let the textarea insert an ordinary newline.
 *
 * On an item with text, this carries the marker down to the new line. On an item
 * that is *only* a marker, it clears the marker instead -- otherwise Enter could
 * never get you back out of a list.
 */
function continueList(value: string, start: number): { text: string; caret: number } | null {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const line = value.slice(lineStart, start);
  const match = LIST_LINE.exec(line);
  if (!match) return null;

  const [, indent, marker, content] = match;
  if (content.trim() === '') {
    const text = value.slice(0, lineStart) + indent + value.slice(start);
    return { text, caret: lineStart + indent.length };
  }

  const insert = '\n' + indent + nextMarker(marker);
  return { text: value.slice(0, start) + insert + value.slice(start), caret: start + insert.length };
}

/**
 * Backspace at the end of a bare marker takes the whole marker, not one space at
 * a time -- so an auto-inserted bullet you didn't want goes in one keystroke and
 * the line returns to free-form typing.
 */
function removeMarker(value: string, start: number): { text: string; caret: number } | null {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const line = value.slice(lineStart, start);
  const match = LIST_LINE.exec(line);
  if (!match) return null;

  const [, indent, , content] = match;
  // Only when the caret sits right after the marker with nothing typed after it.
  if (content !== '') return null;
  const text = value.slice(0, lineStart) + indent + value.slice(start);
  return { text, caret: lineStart + indent.length };
}

const MAX_SUGGESTIONS = 8;
const NO_TAGS: TagSuggestion[] = [];

/**
 * '#tag' is a tag; '# heading' and '## heading' are markdown. Mirrors the rule
 * TagCommentInput uses, so both inputs agree on what a tag looks like.
 */
const isTagPart = (part: string) => part.startsWith('#') && !/^#[#\s]/.test(part);

/**
 * The tag being typed: the last ', '-separated segment of the current line, if
 * it reads as a tag. Segment-based rather than word-based because a tag can hold
 * spaces -- "#long walk, " is one tag.
 */
function pendingTag(value: string, caret: number): { query: string; from: number } | null {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  const line = value.slice(lineStart, caret);
  const cut = line.lastIndexOf(', ');
  const segStart = cut === -1 ? lineStart : lineStart + cut + 2;
  const segment = value.slice(segStart, caret);
  if (!isTagPart(segment)) return null;
  return { query: segment.slice(1).trim().toLowerCase(), from: segStart };
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

  const { data } = useTags();
  const allTags = data ?? NO_TAGS;
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(false);

  const pending = focused && !dismissed ? pendingTag(value, caret) : null;
  const matches = pending === null
    ? NO_TAGS
    : allTags.filter(t => t.tag.toLowerCase().includes(pending.query)).slice(0, MAX_SUGGESTIONS);
  const showSuggestions = pending !== null && matches.length > 0;

  /** Replace the half-typed segment with the finished tag, ready for the next one. */
  const commitTag = (tag: string) => {
    if (!pending) return;
    const insert = `#${tag}, `;
    const next = value.slice(0, pending.from) + insert + value.slice(caret);
    const at = pending.from + insert.length;
    pendingRange.current = { from: at, to: at };
    setDismissed(false);
    onChange(next);
  };

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
        onChange={e => {
          setCaret(e.target.selectionStart);
          setDismissed(false);
          onChange(e.target.value);
        }}
        onSelect={e => setCaret(e.currentTarget.selectionStart)}
        onFocus={e => { setFocused(true); setCaret(e.currentTarget.selectionStart); }}
        onBlur={() => {
          // Let a click on a suggestion land before the list unmounts.
          setTimeout(() => setFocused(false), 120);
          onBlur?.();
        }}
        onKeyDown={e => {
          const el = e.currentTarget;
          const collapsed = el.selectionStart === el.selectionEnd;

          if (showSuggestions) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight(h => (h + 1) % matches.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight(h => (h - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              commitTag(matches[Math.min(highlight, matches.length - 1)].tag);
              setHighlight(0);
              return;
            }
            if (e.key === 'Escape') {
              // Dismisses the list only — the editor stays open.
              e.preventDefault();
              setDismissed(true);
              return;
            }
          }

          // List continuation only makes sense for a plain caret; with a range
          // selected, Enter and Backspace mean "replace this".
          if (e.key === 'Enter' && collapsed && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
            const result = continueList(value, el.selectionStart);
            if (result) {
              e.preventDefault();
              pendingRange.current = { from: result.caret, to: result.caret };
              onChange(result.text);
              return;
            }
          }
          if (e.key === 'Backspace' && collapsed) {
            const result = removeMarker(value, el.selectionStart);
            if (result) {
              e.preventDefault();
              pendingRange.current = { from: result.caret, to: result.caret };
              onChange(result.text);
              return;
            }
          }

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
      {showSuggestions && (
        <ul className="max-h-40 overflow-y-auto border-t border-gray-200 bg-white text-sm">
          {matches.map((t, i) => (
            <li key={t.tag}>
              <button
                type="button"
                // Keep focus in the textarea so the caret stays put.
                onMouseDown={e => e.preventDefault()}
                onClick={() => { commitTag(t.tag); setHighlight(0); }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                  i === Math.min(highlight, matches.length - 1) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span>#{t.tag}</span>
                <span className="text-xs text-gray-500">{t.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
