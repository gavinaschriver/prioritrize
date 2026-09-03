import { createContext, useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Which line of the markdown source the item being rendered starts on, so its
 * checkbox can rewrite the right `[ ]` when clicked. remark-gfm synthesises the
 * checkbox itself, so the input carries no source position of its own — the
 * item around it does.
 */
const TaskItemLine = createContext<number | null>(null);

/**
 * A checkbox line as this app wrote them before it spoke real markdown: `[ ] x`
 * with no bullet. GFM needs the bullet, so those lines get one on the way to the
 * renderer — and keep their original shape on the way back to the database.
 */
const LEGACY_TASK = /^(\s*)\[([ xX])\](\s)/;

/** Either spelling of a checkbox line, GFM's or the legacy one. */
const ANY_TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[|\s*\[)([ xX])(\])/;

/** Give legacy checkbox lines the bullet GFM needs. Line count is preserved,
 *  so a line number here still points at the same line of the original. */
function normalizeTaskLines(source: string): string {
  if (!LEGACY_TASK.test(source) && !/\n\s*\[[ xX]\]\s/.test(source)) return source;
  return source
    .split('\n')
    .map(line => line.replace(LEGACY_TASK, (_m, indent, mark, space) => `${indent}- [${mark}]${space}`))
    .join('\n');
}

/** Flip the checkbox on `line` of `source`, in whichever spelling it uses.
 *  Returns null if the text moved under us and that line has no box. */
function toggleTaskOnLine(source: string, line: number): string | null {
  const lines = source.split('\n');
  const target = lines[line];
  if (target === undefined) return null;
  const match = ANY_TASK.exec(target);
  if (!match) return null;
  lines[line] = target.replace(ANY_TASK, (_m, head, mark, tail) =>
    `${head}${mark === ' ' ? 'x' : ' '}${tail}`
  );
  return lines.join('\n');
}

interface MarkdownProps {
  children: string;
  /** Body text size. The rest of the scale follows it. */
  size?: 'xs' | 'sm';
  className?: string;
  /** Given, checkboxes are live: a click hands back the rewritten source. */
  onToggleTask?: (next: string) => void;
}

/**
 * The one markdown renderer: todo and task descriptions, daily notes, the
 * scratch pad, project overviews and project updates all read through it, so a
 * checklist or a link behaves the same wherever it's written. Tailwind here has
 * no typography plugin, so spacing is set per element, in em so both sizes work
 * from one set of rules.
 */
export function Markdown({ children, size = 'xs', className = '', onToggleTask }: MarkdownProps) {
  const source = useMemo(() => normalizeTaskLines(children), [children]);

  return (
    <div
      className={`${size === 'sm' ? 'text-sm' : 'text-xs'} leading-relaxed break-words space-y-1 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Soft line breaks are meaningful in notes people type by hand, so a
          // paragraph keeps the lines it was written with.
          p: props => <p className="whitespace-pre-wrap" {...props} />,
          ul: ({ className: c, ...props }) => (
            <ul
              className={
                c?.includes('contains-task-list') ? 'ml-1 list-none space-y-0.5' : 'ml-4 list-disc space-y-0.5'
              }
              {...props}
            />
          ),
          ol: props => <ol className="ml-4 list-decimal space-y-0.5" {...props} />,
          li: ({ className: c, node, children: kids, ...props }) => {
            if (!c?.includes('task-list-item')) return <li {...props}>{kids}</li>;
            const box = node?.children?.find(
              child => child.type === 'element' && child.tagName === 'input'
            );
            const done = box?.type === 'element' && box.properties?.checked === true;
            const line = node?.position?.start?.line;
            return (
              <li
                className={`flex items-start gap-1.5 ${done ? 'text-gray-500 line-through' : ''}`}
                {...props}
              >
                <TaskItemLine.Provider value={line != null ? line - 1 : null}>{kids}</TaskItemLine.Provider>
              </li>
            );
          },
          input: props => (
            <TaskCheckbox {...props} source={children} onToggleTask={onToggleTask} />
          ),
          h1: props => <h1 className="text-[1.35em] font-bold text-gray-800 mt-2" {...props} />,
          h2: props => <h2 className="text-[1.15em] font-bold text-gray-800 mt-2" {...props} />,
          h3: props => <h3 className="text-[1.05em] font-semibold text-gray-800 mt-1.5" {...props} />,
          h4: props => <h4 className="font-semibold text-gray-800" {...props} />,
          h5: props => <h5 className="font-semibold text-gray-700" {...props} />,
          h6: props => <h6 className="font-semibold text-gray-700" {...props} />,
          strong: props => <strong className="font-semibold text-gray-800" {...props} />,
          del: props => <del className="text-gray-500" {...props} />,
          code: props => (
            <code className="bg-gray-100 rounded px-1 py-0.5 font-mono text-[0.92em]" {...props} />
          ),
          pre: props => (
            <pre className="bg-gray-100 rounded p-2 overflow-x-auto text-[0.92em]" {...props} />
          ),
          blockquote: props => (
            <blockquote className="border-l-2 border-gray-300 pl-2 text-gray-500 italic" {...props} />
          ),
          a: props => (
            <a
              className="text-blue-600 underline"
              target="_blank"
              rel="noreferrer"
              // These bodies usually sit inside a click-to-edit row; following a
              // link shouldn't also open the editor behind it.
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
          th: props => (
            <th className="border border-gray-200 px-1.5 py-0.5 text-left font-semibold" {...props} />
          ),
          td: props => <td className="border border-gray-200 px-1.5 py-0.5" {...props} />,
        }}
      >
        {source}
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
  const line = useContext(TaskItemLine);
  const live = !!onToggleTask && line !== null;

  if (!live) {
    return <input {...props} readOnly className="mt-0.5 shrink-0 pointer-events-none accent-green-600" />;
  }

  return (
    <input
      {...props}
      disabled={false}
      // The row around this is often click-to-edit; ticking a box shouldn't
      // also open the editor on top of it.
      onClick={e => e.stopPropagation()}
      onChange={e => {
        e.stopPropagation();
        const next = toggleTaskOnLine(source, line);
        if (next !== null) onToggleTask!(next);
      }}
      className="mt-0.5 shrink-0 cursor-pointer accent-green-600"
    />
  );
}
