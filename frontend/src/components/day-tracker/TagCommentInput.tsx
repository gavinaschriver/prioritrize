import { useState, useRef, useEffect } from 'react';

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

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      const parsed = parseComment(value);
      setTags(parsed.tags);
      setInputValue(parsed.text);
    }
  }, [value]);

  const emit = (newTags: string[], newText: string) => {
    const serialized = serializeComment(newTags, newText);
    lastExternal.current = serialized;
    onChange(serialized);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',') {
      const trimmed = inputValue.trim();
      if (trimmed.startsWith('#')) {
        e.preventDefault();
        const tagName = trimmed.slice(1).trim();
        if (tagName) {
          const newTags = [...tags, tagName];
          setTags(newTags);
          setInputValue('');
          emit(newTags, '');
        }
      }
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
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
      className={`flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-200 rounded focus-within:ring-1 focus-within:ring-blue-400 bg-white ${className}`}
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
        onChange={e => {
          setInputValue(e.target.value);
          emit(tags, e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        autoFocus={autoFocus}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] text-xs bg-transparent outline-none"
      />
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
