import {
  isScheduleActiveAt,
  schedulesOverlapInTime,
  expandAdjacentDays,
} from './schedule-active.util';

// Time is minutes-of-day; dayOfWeek 0=Sun..6=Sat. Mon=1.
const H = (h: number, m = 0) => h * 60 + m;

describe('schedule-active.util (single definition — T2 resolver foundation)', () => {
  describe('isScheduleActiveAt', () => {
    const mon9to17 = { daysOfWeek: [1], startTime: H(9), endTime: H(17) };

    it('inside the window is active', () => {
      expect(isScheduleActiveAt(mon9to17, 1, H(10))).toBe(true);
      expect(isScheduleActiveAt(mon9to17, 1, H(9))).toBe(true); // inclusive start
    });

    it('outside the window / wrong day is inactive', () => {
      expect(isScheduleActiveAt(mon9to17, 1, H(17))).toBe(false); // exclusive end
      expect(isScheduleActiveAt(mon9to17, 1, H(20))).toBe(false);
      expect(isScheduleActiveAt(mon9to17, 2, H(10))).toBe(false); // Tue
    });

    it('a day with no start/end is active all day', () => {
      const allDayMon = { daysOfWeek: [1], startTime: null, endTime: null };
      expect(isScheduleActiveAt(allDayMon, 1, H(0))).toBe(true);
      expect(isScheduleActiveAt(allDayMon, 1, H(23, 59))).toBe(true);
      expect(isScheduleActiveAt(allDayMon, 2, H(10))).toBe(false);
    });

    it('a window that wraps past midnight covers both sides of 00:00', () => {
      // Mon 22:00 → 02:00 (Tue)
      const wrap = { daysOfWeek: [1], startTime: H(22), endTime: H(2) };
      expect(isScheduleActiveAt(wrap, 1, H(23))).toBe(true);  // Mon night
      expect(isScheduleActiveAt(wrap, 2, H(1))).toBe(true);   // spills into Tue 01:00
      expect(isScheduleActiveAt(wrap, 2, H(3))).toBe(false);  // after it ends
    });

    it('a Sunday window that wraps into Saturday handles the week boundary', () => {
      const satWrap = { daysOfWeek: [6], startTime: H(23), endTime: H(1) }; // Sat 23:00 → Sun 01:00
      expect(isScheduleActiveAt(satWrap, 0, H(0, 30))).toBe(true); // Sun 00:30 (week wrap)
    });
  });

  describe('schedulesOverlapInTime', () => {
    it('detects overlap on the same day', () => {
      const a = { daysOfWeek: [1], startTime: H(9), endTime: H(12) };
      const b = { daysOfWeek: [1], startTime: H(11), endTime: H(14) };
      expect(schedulesOverlapInTime(a, b)).toBe(true);
    });

    it('reports no overlap for disjoint windows', () => {
      const a = { daysOfWeek: [1], startTime: H(9), endTime: H(12) };
      const b = { daysOfWeek: [1], startTime: H(13), endTime: H(17) };
      expect(schedulesOverlapInTime(a, b)).toBe(false);
    });

    it('reports no overlap across different days', () => {
      const a = { daysOfWeek: [1], startTime: H(9), endTime: H(17) };
      const b = { daysOfWeek: [3], startTime: H(9), endTime: H(17) };
      expect(schedulesOverlapInTime(a, b)).toBe(false);
    });
  });

  describe('expandAdjacentDays', () => {
    it('includes each day plus its neighbors (for wrap-aware conflict scans)', () => {
      expect(expandAdjacentDays([1]).sort()).toEqual([0, 1, 2]);
      expect(expandAdjacentDays([0]).sort()).toEqual([0, 1, 6]); // Sun wraps to Sat
    });
  });
});
