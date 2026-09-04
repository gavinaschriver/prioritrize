import { createContext, useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { useItemRefNav } from './itemRefNav';

/**
 * Markdown has no underline, so the toolbar's U writes a literal <u> tag. That
 * means raw HTML has to survive the pipeline -- and everything dangerous has to
 * not. rehype-raw parses the tags, rehype-sanitize then enforces GitHub's
 * allowlist with <u> added.
 */
const SCHEMA = {
  ...defaultSchema,
  // Only `u` is added. Sanitising sees the whole tree, not just the raw HTML, so
  // narrowing the default list would also strip what the normal pipeline builds:
  // the `contains-task-list` / `task-list-item` classes and the `checked` state
  // that make checkboxes work, plus links and paragraphs. Verified against the
  // real pipeline: <script> and javascript: hrefs are dropped, on* attributes
  // are dropped, task lists and links come through intact.
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
};

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

/**
 * A reference to another todo or task: '#' plus at least four digits. Four is the
 * floor because reference numbers start at 1000, which keeps '#1' and '#2026'
 * apart from tags like '#gym' without a lookup — a '#' followed by letters is
 * always a tag, a '#' followed by four or more digits is always a reference.
 */
const ITEM_REF = /#(\d{4,})/g;

/**
 * Split a run of text into plain strings and reference numbers. Applied to text
 * nodes only, so a '#1042' inside a link's href or a code span is left alone.
 */
function splitRefs(text: string): (string | number)[] {
  const out: (string | number)[] = [];
  let last = 0;
  for (const match of text.matchAll(ITEM_REF)) {
    const at = match.index!;
    if (at > last) out.push(text.slice(last, at));
    out.push(Number(match[1]));
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Renders '#1042' as a link that opens that item, leaving everything else be. */
function WithRefs({ children }: { children: React.ReactNode }) {
  const nav = useItemRefNav();
  if (!nav) return <>{children}</>;

  const render = (node: React.ReactNode, key?: React.Key): React.ReactNode => {
    if (typeof node === 'string') {
      const parts = splitRefs(node);
      if (parts.length === 1 && typeof parts[0] === 'string') return node;
      return (
        <span key={key}>
          {parts.map((part, i) =>
            typeof part === 'string' ? (
              part
            ) : (
              <button
                key={i}
                type="button"
                // These bodies often sit inside a click-to-edit surface or a
                // tappable card; following a reference shouldn't also trigger it.
                onClick={e => { e.stopPropagation(); nav.open(part); }}
                className="font-medium text-blue-600 hover:underline"
                title={`Open #${part}`}
              >
                #{part}
              </button>
            ),
          )}
        </span>
      );
    }
    if (Array.isArray(node)) return node.map((n, i) => render(n, i));
    return node;
  };

  return <>{render(children)}</>;
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
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SCHEMA]]}
        components={{
          // Soft line breaks are meaningful in notes people type by hand, so a
          // paragraph keeps the lines it was written with.
          p: ({ children: kids, ...props }) => (
            <p className="whitespace-pre-wrap" {...props}>
              <WithRefs>{kids}</WithRefs>
            </p>
          ),
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
            if (!c?.includes('task-list-item')) {
              return <li {...props}><WithRefs>{kids}</WithRefs></li>;
            }
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
                <TaskItemLine.Provider value={line != null ? line - 1 : null}>
                  <WithRefs>{kids}</WithRefs>
                </TaskItemLine.Provider>
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
          u: props => <u {...props} />,
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
