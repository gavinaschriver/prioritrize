import type { CSSProperties } from 'react';

/** Whole days from the viewed day to the due date. Negative means overdue. */
function daysUntil(dueDate: string, viewedDate: string): number {
  const due = new Date(dueDate + 'T12:00:00').getTime();
  const viewed = new Date(viewedDate + 'T12:00:00').getTime();
  return Math.round((due - viewed) / 86400000);
}

/** A week out is where the colour scale starts. Past that a due date isn't news
 *  yet, so the row stays plain. */
const HORIZON = 7;
/** How close a due date has to be before the row wears a badge about it. */
const BADGE_DAYS = 3;
/** A week overdue is as loud as it gets, so week-old debt doesn't keep escalating. */
const OVERDUE_FLOOR = 7;

interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Three stops — calm, middle, urgent — that a 0..1 position rides between. */
type Ramp = [Hsl, Hsl, Hsl];

// Backgrounds stay pale enough for the row's text; the border carries the
// saturation, so the signal reads at a glance without shouting.
const BG: Ramp = [
  { h: 140, s: 45, l: 96 }, // a week out: lightest green
  { h: 55, s: 85, l: 91 },  // mid-week: yellow
  { h: 4, s: 80, l: 90 },   // due today: red
];
const BORDER: Ramp = [
  { h: 140, s: 35, l: 78 },
  { h: 50, s: 75, l: 60 },
  { h: 4, s: 72, l: 62 },
];
// Past due, the same hue keeps deepening — a week late should look worse than a
// day late, not identical to it.
const BG_OVERDUE: Hsl = { h: 0, s: 72, l: 84 };
const BORDER_OVERDUE: Hsl = { h: 0, s: 65, l: 45 };

// The badge rides the same hues as the row it sits on, dark enough to carry
// white text at every point on the ramp.
const BADGE: Ramp = [
  { h: 140, s: 40, l: 36 },
  { h: 45, s: 90, l: 30 }, // dark enough that 10px white text clears 4.5:1 here too
  { h: 4, s: 70, l: 45 },
];
const BADGE_OVERDUE: Hsl = { h: 0, s: 70, l: 38 };

const mix = (a: Hsl, b: Hsl, t: number): Hsl => ({
  h: a.h + (b.h - a.h) * t,
  s: a.s + (b.s - a.s) * t,
  l: a.l + (b.l - a.l) * t,
});

/** Position `t` (0 = calm, 1 = urgent) along a three-stop ramp. */
const along = (ramp: Ramp, t: number): Hsl =>
  t <= 0.5 ? mix(ramp[0], ramp[1], t * 2) : mix(ramp[1], ramp[2], (t - 0.5) * 2);

const css = ({ h, s, l }: Hsl) => `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;

/**
 * Row styling for anything in a queue (todos, project tasks), driven purely by how
 * close the due date is to the day being viewed. The colour is computed rather than
 * picked from a handful of buckets, so each day closer is a visible step along one
 * green → yellow → red ramp instead of two shades of yellow that look alike.
 * Completed items never reach here; they move into the Completed Today list.
 */
export function urgencyRow(
  dueDate: string | null,
  viewedDate: string,
): { className: string; style?: CSSProperties } {
  const className = 'rounded-lg px-2 -mx-2 border';
  if (!dueDate) return { className: `${className} bg-gray-50 border-gray-200` };

  const days = daysUntil(dueDate, viewedDate);
  // Further out than the horizon is not yet news — the row stays as plain as an
  // undated one rather than tinting a week of green over everything.
  if (days > HORIZON) return { className: `${className} bg-transparent border-gray-200` };

  if (days < 0) {
    // Overdue rides its own short ramp, from "due today" red into the deep end.
    const past = Math.min(-days, OVERDUE_FLOOR) / OVERDUE_FLOOR;
    return {
      className,
      style: {
        backgroundColor: css(mix(along(BG, 1), BG_OVERDUE, past)),
        borderColor: css(mix(along(BORDER, 1), BORDER_OVERDUE, past)),
      },
    };
  }

  const t = 1 - Math.min(days, HORIZON) / HORIZON;
  return {
    className,
    style: {
      backgroundColor: css(along(BG, t)),
      borderColor: css(along(BORDER, t)),
    },
  };
}

/**
 * The shout on a row whose due date is close: nothing until three days out, then
 * a badge counting down through today and into overdue. Colour tracks the row's
 * own ramp, so the badge deepens with it instead of being a second scale to learn.
 */
export function dueBadge(
  dueDate: string | null,
  viewedDate: string,
): { label: string; style: CSSProperties } | null {
  if (!dueDate) return null;
  const days = daysUntil(dueDate, viewedDate);
  if (days > BADGE_DAYS) return null;

  const overdue = days < 0;
  const label = overdue
    ? 'overdue'
    : days === 0
      ? 'due today'
      : days === 1
        ? 'due in 1 day'
        : `due in ${days} days`;

  const backgroundColor = css(
    overdue
      ? mix(along(BADGE, 1), BADGE_OVERDUE, Math.min(-days, OVERDUE_FLOOR) / OVERDUE_FLOOR)
      : along(BADGE, 1 - days / HORIZON)
  );
  return { label, style: { backgroundColor } };
}

/** "Jul 28" — the same shape everywhere a due date is shown. */
export function formatDueDate(dueDate: string): string {
  return new Date(dueDate + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
