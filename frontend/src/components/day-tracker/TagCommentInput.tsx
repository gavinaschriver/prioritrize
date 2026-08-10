import { useState, useRef, useEffect, useMemo } from 'react';
import { useTags } from '../../hooks/useTags';
import type { TagSuggestion } from '../../types';

export function parseComment(raw: string): { tags: string[]; text: string } {
  if (!raw.trim()) return { tags: [], text: '' };
  const parts = raw.split(', ');
  const tags: string[] = [];
  let textStartIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('#')) {
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

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      const parsed = parseComment(value);
      setTags(parsed.tags);
      setInputValue(parsed.text);
    }
  }, [value]);

  // Only the segment currently being typed can be a tag, and only once it opens with '#'.
  const query = inputValue.startsWith('#')
    ? inputValue.slice(1).trim().toLowerCase()
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

  const commitTag = (tag: string) => {
    const newTags = [...tags, tag];
    setTags(newTags);
    setInputValue('');
    emit(newTags, '');
    setHighlight(0);
    setDismissed(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHighlight(0);
    setDismissed(false);
    // Form a tag when the user types ", " after a #word(s) segment
    if (val.startsWith('#') && val.endsWith(', ')) {
      const tagName = val.slice(1, -2).trim();
      if (tagName) {
        commitTag(tagName);
        return;
      }
    }
    setInputValue(val);
    emit(tags, val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        commitTag(matches[activeIndex].tag);
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
    } else if (e.key === 'Enter' && onSubmit) {
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
            onClick={() => removeTag(i)}
            className="ml-0.5 text-blue-400 hover:text-blue-700 leading-none font-bold"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        autoFocus={autoFocus}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] text-xs bg-transparent outline-none"
      />

      {showSuggestions && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-md py-1">
          {matches.map((s, i) => (
            <li key={s.tag}>
              <button
                type="button"
                // Keeps focus in the input so EditableComment's onBlur=save
                // doesn't fire and tear the dropdown down before onClick lands.
                onMouseDown={e => e.preventDefault()}
                onClick={() => commitTag(s.tag)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1 text-left ${
                  i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="inline-flex items-center bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 font-medium">
                  #{s.tag}
                </span>
                <span className="text-xs text-gray-400 font-mono">{s.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Read-only display of a serialized comment string — shows tags as pills. */
export function CommentDisplay({ value, onClick, className = '' }: {
  value: string | null;
  onClick?: () => void;
  className?: string;
}) {
  const { tags, text } = parseComment(value ?? '');
  const empty = tags.length === 0 && !text;

  return (
    <p
      onClick={onClick}
      className={`flex flex-wrap items-center gap-1 text-xs mt-0.5 ${onClick ? 'cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors' : ''} ${className}`}
      title={onClick ? 'Click to edit comment' : undefined}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium"
        >
          #{tag}
        </span>
      ))}
      {text && <span className="text-gray-500 italic">{text}</span>}
      {empty && onClick && <span className="text-gray-400 italic">Add comment...</span>}
    </p>
  );
}
