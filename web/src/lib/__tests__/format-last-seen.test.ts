import { formatLastSeen } from '../format-last-seen';

const NOW = new Date('2026-08-13T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

describe('formatLastSeen', () => {
  it('collapses sub-minute ages to "Just now"', () => {
    // The underlying value can legitimately be up to a minute stale, so
    // second-level precision would imply accuracy it does not have.
    expect(formatLastSeen(ago(5), NOW)).toBe('Just now');
    expect(formatLastSeen(ago(59), NOW)).toBe('Just now');
  });

  it('reports minutes, hours and days with correct pluralisation', () => {
    expect(formatLastSeen(ago(60), NOW)).toBe('1 min ago');
    expect(formatLastSeen(ago(120), NOW)).toBe('2 mins ago');
    expect(formatLastSeen(ago(3600), NOW)).toBe('1 hour ago');
    expect(formatLastSeen(ago(7200), NOW)).toBe('2 hours ago');
    expect(formatLastSeen(ago(86_400), NOW)).toBe('1 day ago');
    expect(formatLastSeen(ago(172_800), NOW)).toBe('2 days ago');
  });

  it('tolerates small clock skew instead of reporting the future', () => {
    // Device, server and browser clocks disagree slightly all the time;
    // "in 4 seconds" reads as a bug.
    expect(formatLastSeen(new Date(NOW.getTime() + 4000), NOW)).toBe('Just now');
  });

  it('returns Unknown for an unparseable value rather than "Invalid Date"', () => {
    expect(formatLastSeen('not-a-date', NOW)).toBe('Unknown');
  });
});
