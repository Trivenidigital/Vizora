import { timeAgo, formatDate, formatBytes } from '../formatters';

describe('timeAgo', () => {
  it('returns "Never" for null', () => {
    expect(timeAgo(null)).toBe('Never');
  });

  it('returns "Never" for undefined', () => {
    expect(timeAgo(undefined)).toBe('Never');
  });

  it('returns "Just now" for dates less than 60 seconds ago', () => {
    const now = new Date();
    expect(timeAgo(now.toISOString())).toBe('Just now');

    const thirtySecsAgo = new Date(now.getTime() - 30 * 1000);
    expect(timeAgo(thirtySecsAgo.toISOString())).toBe('Just now');
  });

  it('returns "Xm ago" for dates less than 1 hour ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(timeAgo(fiveMinAgo.toISOString())).toBe('5m ago');

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(timeAgo(thirtyMinAgo.toISOString())).toBe('30m ago');
  });

  it('returns "Xh ago" for dates less than 1 day ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    expect(timeAgo(twoHoursAgo.toISOString())).toBe('2h ago');

    const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000);
    expect(timeAgo(twelveHoursAgo.toISOString())).toBe('12h ago');
  });

  it('returns "Xd ago" for dates less than 1 week ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000);
    expect(timeAgo(threeDaysAgo.toISOString())).toBe('3d ago');

    const sixDaysAgo = new Date(Date.now() - 6 * 86400 * 1000);
    expect(timeAgo(sixDaysAgo.toISOString())).toBe('6d ago');
  });

  it('returns a formatted date for dates older than 1 week', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000);
    const result = timeAgo(twoWeeksAgo.toISOString());
    // Should fall through to formatDate, which returns a locale-formatted string
    expect(result).not.toBe('Never');
    expect(result).not.toMatch(/ago$/);
    expect(result).not.toBe('Just now');
    // Should contain a year number
    expect(result).toMatch(/\d{4}/);
  });
});

describe('formatDate', () => {
  it('returns "N/A" for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('returns a short formatted date string', () => {
    // Use a fixed date to avoid locale-dependent month names
    const result = formatDate('2024-01-15T12:00:00Z');
    // Should contain day, year, and a month abbreviation
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
    // Month should be "Jan" in English locales (test env default)
    expect(result).toMatch(/Jan/);
  });
});

describe('formatBytes', () => {
  it('returns "0 B" for null', () => {
    expect(formatBytes(null)).toBe('0 B');
  });

  it('returns "0 B" for undefined', () => {
    expect(formatBytes(undefined)).toBe('0 B');
  });

  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1)).toBe('1 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});
