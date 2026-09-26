import type { TimelineSection } from '../../types';

/** The day's three stretches. Loose on purpose — no hourly grid, just an order. */
export const SECTIONS: { key: TimelineSection; label: string; start: string; end: string }[] = [
  { key: 'morning', label: 'Morning', start: '7 AM', end: '12 PM' },
  { key: 'afternoon', label: 'Afternoon', start: '12 PM', end: '5 PM' },
  { key: 'evening', label: 'Evening', start: '5 PM', end: '10 PM' },
];
