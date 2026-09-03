import { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Where the list item being rendered starts in the markdown source, so its
 * checkbox can rewrite the right `[ ]` when clicked. remark-gfm synthesises the
 * checkbox itself, so the input carries no source position of its own — the
 * item around it does.
 */
const TaskItemOffset = createContext<number | null>(null);

/**
 * Flip the `[ ]`/`[x]` of the task item starting at `offset`. Returns null if
 * the source moved under us and there's no marker there any more.
 */
function toggleTaskAt(source: string, offset: number): string | null {
  const rest = source.slice(offset);
  const match = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/.exec(rest);
  if (!match) return null;
  const at = offset + match[1].length;
  return source.slice(0, at) + (match[2] === ' ' ? 'x' : ' ') + source.slice(at + 1);
}

/**
 * Renders a description or comment body as markdown. Tailwind here has no
 * typography plugin, so every element the fields actually use — lists, task
 * lists, emphasis, code, links, headings — gets its spacing set explicitly,
 * sized to sit inside a todo row rather than a document.
 */
export function Markdown({
  children,
  className = '',
  onToggleTask,
}: {
  children: string;
  className?: string;
  /** Given, checkboxes are live: a click hands back the rewritten source. */
  onToggleTask?: (next: string) => void;
}) {
  return (
    <div className={`text-xs text-gray-600 leading-relaxed break-words space-y-1 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: props => <p className="whitespace-pre-wrap" {...props} />,
          ul: ({ className: c, ...props }) => (
            // A task list drops the bullets; a plain list keeps them.
            <ul
              className={`ml-4 space-y-0.5 ${c?.includes('contains-task-list') ? 'list-none ml-1' : 'list-disc'}`}
              {...props}
            />
          ),
          ol: props => <ol className="ml-4 list-decimal space-y-0.5" {...props} />,
          li: ({ className: c, node, children, ...props }) => {
            const task = c?.includes('task-list-item');
            const offset = node?.position?.start?.offset;
            return (
              <li className={task ? 'flex items-start gap-1.5' : ''} {...props}>
                {task ? (
                  <TaskItemOffset.Provider value={offset ?? null}>{children}</TaskItemOffset.Provider>
                ) : (
                  children
                )}
              </li>
            );
          },
          input: props => <TaskCheckbox {...props} source={children} onToggleTask={onToggleTask} />,
          h1: props => <h1 className="text-sm font-bold text-gray-800" {...props} />,
          h2: props => <h2 className="text-xs font-bold text-gray-800" {...props} />,
          h3: props => <h3 className="text-xs font-semibold text-gray-800" {...props} />,
          h4: props => <h4 className="text-xs font-semibold text-gray-700" {...props} />,
          h5: props => <h5 className="text-xs font-semibold text-gray-700" {...props} />,
          h6: props => <h6 className="text-xs font-semibold text-gray-700" {...props} />,
          strong: props => <strong className="font-semibold text-gray-800" {...props} />,
          code: props => (
            <code className="bg-gray-100 rounded px-1 py-0.5 font-mono text-[11px]" {...props} />
          ),
          pre: props => (
            <pre className="bg-gray-100 rounded p-2 overflow-x-auto text-[11px]" {...props} />
          ),
          blockquote: props => (
            <blockquote className="border-l-2 border-gray-300 pl-2 text-gray-500 italic" {...props} />
          ),
          a: props => (
            <a
              className="text-blue-600 underline"
              target="_blank"
              rel="noreferrer"
              // The whole row is click-to-edit; a link click should follow the
              // link instead of opening the editor behind it.
              onClick={e => e.stopPropagation()}
              {...props}
            />
          ),
          hr: () => <hr className="border-gray-200" />,
          table: props => (
            <div className="overflow-x-auto">
              <table className="border-collapse" {...props} />
            </div>
          ),
          th: props => <th className="border border-gray-200 px-1.5 py-0.5 text-left font-semibold" {...props} />,
          td: props => <td className="border border-gray-200 px-1.5 py-0.5" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * A rendered checklist box. Without a toggle handler it's inert display; with
 * one, clicking it checks the item off in place — no need to open the editor
 * and hand-edit the brackets.
 */
function TaskCheckbox({
  source,
  onToggleTask,
  ...props
}: React.ComponentProps<'input'> & { source: string; onToggleTask?: (next: string) => void }) {
  const offset = useContext(TaskItemOffset);
  const live = !!onToggleTask && offset !== null;

  if (!live) {
    return <input {...props} readOnly className="mt-0.5 pointer-events-none accent-green-600" />;
  }

  return (
    <input
      {...props}
      disabled={false}
      // The row around this is click-to-edit; ticking a box shouldn't also
      // open the editor on top of it.
      onClick={e => e.stopPropagation()}
      onChange={e => {
        e.stopPropagation();
        const next = toggleTaskAt(source, offset);
        if (next !== null) onToggleTask!(next);
      }}
      className="mt-0.5 cursor-pointer accent-green-600"
    />
  );
}
