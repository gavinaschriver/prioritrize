import { Fragment } from 'react';

/**
 * The address shapes worth catching in a one-line comment: an explicit scheme,
 * a bare 'www.' host, or an email. A bare 'example.com' is left alone — too
 * many file names and abbreviations look like one.
 */
const ADDRESS = /(https?:\/\/[^\s<]+|www\.[^\s<]+|[\w.+-]+@[\w-]+\.[\w.-]*[\w-])/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"\]}]+$/;

/** Trim the sentence punctuation the address picked up on its way past. */
function trimAddress(raw: string): string {
  let addr = raw.replace(TRAILING_PUNCTUATION, '');
  // A ')' belongs to the address only if the address opened it — so
  // "(see https://x.com/a)" drops it but ".../Foo_(bar)" keeps it.
  while (addr.endsWith(')') && addr.split(')').length > addr.split('(').length) {
    addr = addr.slice(0, -1).replace(TRAILING_PUNCTUATION, '');
  }
  return addr;
}

function hrefFor(addr: string): string {
  if (/^https?:\/\//i.test(addr)) return addr;
  if (addr.includes('@')) return `mailto:${addr}`;
  return `https://${addr}`;
}

/**
 * Turns the addresses in a plain string into links, for the one-line comment
 * fields. The multi-line description and comment bodies get this from markdown
 * instead — see Markdown.tsx.
 */
export function Linkify({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(ADDRESS)) {
    const start = match.index;
    const addr = trimAddress(match[0]);
    if (!addr) continue;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <a
        key={start}
        href={hrefFor(addr)}
        target="_blank"
        rel="noreferrer"
        // The row is click-to-edit; following a link shouldn't also open the
        // editor behind it.
        onClick={e => e.stopPropagation()}
        className="text-blue-600 underline not-italic"
      >
        {addr}
      </a>
    );
    cursor = start + addr.length;
  }

  if (cursor === 0) return <>{text}</>;
  if (cursor < text.length) out.push(text.slice(cursor));
  return (
    <>
      {out.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
