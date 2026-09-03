import { useState, useRef, useEffect, useMemo } from 'react';
import { useTags } from '../../hooks/useTags';
import { Linkify } from '../shared/Linkify';
import { Markdown } from '../shared/Markdown';
import type { TagSuggestion } from '../../types';

/** The one field a comment and a markdown body share. */
type FieldElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * '#tag' is a pill; '# heading' and '## heading' are markdown. Tags never span
 * lines either, so a body that happens to contain ', ' can't be eaten as one.
 */
const isTagPart = (part: string) =>
  part.startsWith('#') && !/^#[#\s]/.test(part) && !part.includes('\n');

export function parseComment(raw: string): { tags: string[]; text: string } {
  if (!raw.trim()) return { tags: [], text: '' };
  const parts = raw.split(', ');
  const tags: string[] = [];
  let textStartIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (isTagPart(parts[i])) {
      tags.push(parts[i].slice(1));
      textStartIdx = i + 1;
    } else {
      break;
    }
  }
  return { tags, text: parts.slice(textStartIdx).join(', ') };
}

export function serializeComment(tags: string[], text: string): string {
  const parts = [
    ...tags.map(t => `#${t}`),
    ...(text.trim() ? [text.trim()] : []),
  ];
  return parts.join(', ');
}

const MAX_SUGGESTIONS = 8;
const NO_TAGS: TagSuggestion[] = [];

interface TagCommentInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
  onBlur?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  /** Multi-line markdown body: a growing textarea where Enter is a newline. */
  multiline?: boolean;
}

export function TagCommentInput({
  value,
  onChange,
  placeholder = 'Comment or #tag,',
  className = '',
  onSubmit,
  onBlur,
  onEscape,
  autoFocus,
  multiline = false,
}: TagCommentInputProps) {
  const init = parseComment(value);
  const [tags, setTags] = useState<string[]>(init.tags);
  const [inputValue, setInputValue] = useState(init.text);
  const lastExternal = useRef(value);

  const { data } = useTags();
  const allTags = data ?? NO_TAGS;
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<FieldElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  // Committing a pill rewrites the field, so put the cursor back where the user
  // was typing instead of letting the browser drop it at the end.
  useEffect(() => {
    if (pendingCaret.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [inputValue]);

  // The textarea grows with what's in it, so a long description doesn't get
  // written through a three-line porthole.
  useEffect(() => {
    const el = inputRef.current;
    if (multiline && el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [inputValue, multiline]);

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      const parsed = parseComment(value);
      setTags(parsed.tags);
      setInputValue(parsed.text);
    }
  }, [value]);

  // The tag being typed runs from a leading '#' to the caret — anything past the
  // caret is body text the user is typing in front of, not part of the tag.
  // (Editing an existing comment puts that body text in the field from the start.)
  const pending = isTagPart(inputValue.slice(0, caret)) && caret > 0
    ? inputValue.slice(1, caret)
    : null;
  const query = pending !== null && !pending.includes(',')
    ? pending.trim().toLowerCase()
    : null;

  const matches = useMemo(() => {
    if (query === null) return NO_TAGS;
    const taken = new Set(tags.map(t => t.toLowerCase()));
    const pool = allTags.filter(s => !taken.has(s.tag.toLowerCase()));
    if (query === '') return pool.slice(0, MAX_SUGGESTIONS);

    // Prefix matches first, then substring — frequency order is preserved inside each group.
    const prefix: TagSuggestion[] = [];
    const substring: TagSuggestion[] = [];
    for (const s of pool) {
      const lower = s.tag.toLowerCase();
      if (lower.startsWith(query)) prefix.push(s);
      else if (lower.includes(query)) substring.push(s);
    }
    return [...prefix, ...substring].slice(0, MAX_SUGGESTIONS);
  }, [query, allTags, tags]);

  const showSuggestions = focused && !dismissed && matches.length > 0;
  // matches can shrink as you keep typing, stranding highlight past the end.
  const activeIndex = Math.min(highlight, matches.length - 1);

  const emit = (newTags: string[], newText: string) => {
    const serialized = serializeComment(newTags, newText);
    lastExternal.current = serialized;
    onChange(serialized);
  };

  /** Turn the text up to `consumed` into a pill, keeping whatever follows it. */
  const commitTag = (tag: string, source: string, consumed: number) => {
    const newTags = [...tags, tag];
    const rest = source.slice(consumed).replace(/^,\s*/, '');
    setTags(newTags);
    setInputValue(rest);
    emit(newTags, rest);
    setHighlight(0);
    setDismissed(false);
    // The pill left the field, so the remaining text now starts at 0.
    setCaret(0);
    pendingCaret.current = 0;
  };

  const handleChange = (e: React.ChangeEvent<FieldElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setHighlight(0);
    setDismissed(false);
    setCaret(pos);
    // Form a tag when the user types ", " after a #word(s) segment. Only the text
    // before the caret counts, so this fires while typing in front of body text too.
    const before = val.slice(0, pos);
    if (isTagPart(before) && before.endsWith(', ')) {
      const tagName = before.slice(1, -2).trim();
      if (tagName && !tagName.includes(',')) {
        commitTag(tagName, val, pos);
        return;
      }
    }
    setInputValue(val);
    emit(tags, val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<FieldElement>) => {
    // While the dropdown is up it owns the arrows, Enter, Tab and Escape.
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(h => (Math.min(h, matches.length - 1) + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(h => (Math.min(h, matches.length - 1) - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitTag(matches[activeIndex].tag, inputValue, caret);
        return;
      }
      if (e.key === 'Escape') {
        // First Escape only closes the dropdown; a second one reaches onEscape.
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }

    if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      const newTags = tags.slice(0, -1);
      setTags(newTags);
      emit(newTags, '');
    } else if (e.key === 'Enter' && onSubmit && (!multiline || e.metaKey || e.ctrlKey)) {
      // In a markdown body Enter is a newline; ⌘/Ctrl+Enter is the way out.
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
    }
  };

  const removeTag = (idx: number) => {
    const newTags = tags.filter((_, i) => i !== idx);
    setTags(newTags);
    emit(newTags, inputValue);
  };

  return (
    <div
      className={`relative flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-200 rounded focus-within:ring-1 focus-within:ring-blue-400 bg-white ${className}`}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 font-medium"
        >
          #{tag}
          <button
            type="button"
            // Without this the input blurs first, EditableComment saves and
            // unmounts us, and the click never reaches this button.
            onMouseDown={e => e.preventDefault()}
            onClick={() => removeTag(i)}
            className="ml-0.5 text-blue-400 hover:text-blue-700 leading-none font-bold"
          >
            ×
          </button>
        </span>
      ))}
      {multiline ? (
        <textarea
          ref={el => {
            inputRef.current = el;
          }}
          rows={4}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={e => setCaret(e.currentTarget.selectionStart ?? 0)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          autoFocus={autoFocus}
          placeholder={tags.length === 0 ? placeholder : ''}
          // Full width on its own line — pills sit above the body, not beside it.
          className="w-full min-h-[5rem] text-xs bg-transparent outline-none resize-none overflow-hidden font-mono leading-relaxed"
        />
      ) : (
        <input
          ref={el => {
            inputRef.current = el;
          }}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          // Fires for clicks and arrow-key moves too, so the tag-in-progress
          // stays correct however the caret got where it is.
          onSelect={e => setCaret(e.currentTarget.selectionStart ?? 0)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          autoFocus={autoFocus}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] text-xs bg-transparent outline-none"
        />
      )}

      {showSuggestions && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-md py-1">
          {matches.map((s, i) => (
            <li key={s.tag}>
              <button
                type="button"
                // Keeps focus in the input so EditableComment's onBlur=save
                // doesn't fire and tear the dropdown down before onClick lands.
                onMouseDown={e => e.preventDefault()}
                onClick={() => commitTag(s.tag, inputValue, caret)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1 text-left ${
                  i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="inline-flex items-center bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 font-medium">
                  #{s.tag}
                </span>
                <span className="text-xs text-gray-500 font-mono">{s.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Read-only display of a serialized comment string — shows tags as pills. */
export function CommentDisplay({
  value,
  onClick,
  className = '',
  emptyLabel = 'Add comment...',
  editTitle = 'Click to edit comment',
  multiline = false,
  onToggleTask,
}: {
  value: string | null;
  onClick?: () => void;
  className?: string;
  emptyLabel?: string;
  editTitle?: string;
  multiline?: boolean;
  /** Given, checklist boxes are live and hand back the whole rewritten value. */
  onToggleTask?: (next: string) => void;
}) {
  const { tags, text } = parseComment(value ?? '');
  const empty = tags.length === 0 && !text;
  const clickable = onClick
    ? 'cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors'
    : '';
  const pills = tags.map((tag, i) => (
    <span
      key={i}
      className="inline-flex items-center bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium"
    >
      #{tag}
    </span>
  ));

  // A markdown body needs block elements, so it can't live in the inline <p>
  // the one-line comment fields use.
  if (multiline) {
    return (
      <div
        onClick={onClick}
        className={`text-xs mt-0.5 ${clickable} ${className}`}
        title={onClick ? editTitle : undefined}
      >
        {tags.length > 0 && <div className="flex flex-wrap items-center gap-1 mb-0.5">{pills}</div>}
        {text && (
          <Markdown
            className="text-gray-600"
            onToggleTask={
              // The pills live in the same string, so put them back in front of
              // the rewritten body before handing it up to be saved.
              onToggleTask && (next => onToggleTask(serializeComment(tags, next)))
            }
          >
            {text}
          </Markdown>
        )}
        {empty && onClick && <span className="text-gray-500 italic">{emptyLabel}</span>}
      </div>
    );
  }

  return (
    <p
      onClick={onClick}
      className={`flex flex-wrap items-center gap-1 text-xs mt-0.5 ${clickable} ${className}`}
      title={onClick ? editTitle : undefined}
    >
      {pills}
      {text && (
        <span className="text-gray-500 italic">
          <Linkify text={text} />
        </span>
      )}
      {empty && onClick && <span className="text-gray-500 italic">{emptyLabel}</span>}
    </p>
  );
}
