import React from 'react';

// Parse inline markup: **bold**, *italic*, ~~strikethrough~~
function parseInline(text: string): React.ReactNode {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('~~') && part.endsWith('~~'))
          return <s key={i} className="text-gray-400">{part.slice(2, -2)}</s>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i}>{part.slice(1, -1)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface MarkdownRendererProps {
  text: string;
  onCheckboxToggle?: (newText: string) => void;
  className?: string;
}

export function MarkdownRenderer({ text, onCheckboxToggle, className }: MarkdownRendererProps) {
  const lines = text.split('\n');

  const handleCheck = (index: number, checked: boolean) => {
    if (!onCheckboxToggle) return;
    const updated = lines.map((line, i) => {
      if (i !== index) return line;
      return checked ? line.replace(/^\[ \]/, '[x]') : line.replace(/^\[x\]/i, '[ ]');
    });
    onCheckboxToggle(updated.join('\n'));
  };

  return (
    <div className={className}>
      {lines.map((line, i) => {
        // Headings
        if (/^### /.test(line))
          return <h3 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">{parseInline(line.slice(4))}</h3>;
        if (/^## /.test(line))
          return <h2 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-1">{parseInline(line.slice(3))}</h2>;
        if (/^# /.test(line))
          return <h1 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-1">{parseInline(line.slice(2))}</h1>;

        // Checkboxes
        const unchecked = /^\[ \] /.test(line);
        const checked = /^\[x\] /i.test(line);
        if (unchecked || checked) {
          const label = line.slice(4);
          return (
            <label key={i} className={`flex items-start gap-2 py-0.5 ${onCheckboxToggle ? 'cursor-pointer' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={e => handleCheck(i, e.target.checked)}
                disabled={!onCheckboxToggle}
                className="mt-0.5 shrink-0"
              />
              <span className={`text-sm ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {parseInline(label)}
              </span>
            </label>
          );
        }

        // Bullet points: - item or * item (but not [ ] checkboxes)
        if (/^[-*] /.test(line))
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5 shrink-0 text-xs">•</span>
              <p className="text-sm text-gray-700">{parseInline(line.slice(2))}</p>
            </div>
          );

        // Empty line → spacer
        if (line.trim() === '')
          return <div key={i} className="h-2" />;

        // Default paragraph
        return (
          <p key={i} className="text-sm text-gray-700">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}
