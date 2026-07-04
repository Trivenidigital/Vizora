/**
 * Pure schedule-activity math — the SINGLE definition of "is this schedule active
 * now?" and "do two schedules overlap?". Extracted from SchedulesService (T2
 * coherence ruling) so the effective-content resolver can reuse the exact same
 * evaluation. No Prisma, no I/O — trivially movable to `@vizora/shared` once that
 * package's cross-app consumption path is wired (see docs/pull-on-connect.md);
 * until then it lives here and is imported by findActiveSchedules.
 *
 * Time model: minutes since the start of the week (Sunday 00:00). `expandWeeklyIntervals`
 * turns a schedule window into [start,end) minute-intervals, wrapping past midnight and
 * across the week boundary; `isScheduleActiveAt`/`intervalsOverlap` test membership/overlap
 * with ±1 week shifts so the wrap is handled uniformly.
 */

export const MINUTES_PER_DAY = 24 * 60;
export const DAYS_PER_WEEK = 7;
export const MINUTES_PER_WEEK = DAYS_PER_WEEK * MINUTES_PER_DAY;

export type ScheduleWindow = {
  daysOfWeek: number[];
  startTime?: number | null;
  endTime?: number | null;
};

export const previousDay = (day: number) => (day + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
export const nextDay = (day: number) => (day + 1) % DAYS_PER_WEEK;

export const expandAdjacentDays = (days: number[]): number[] => Array.from(new Set(
  days.flatMap((day) => [day, previousDay(day), nextDay(day)]),
));

export const expandWeeklyIntervals = (window: ScheduleWindow): Array<{ start: number; end: number }> => {
  return window.daysOfWeek.flatMap((day) => {
    if (window.startTime == null || window.endTime == null || window.startTime === window.endTime) {
      return [{ start: day * MINUTES_PER_DAY, end: (day + 1) * MINUTES_PER_DAY }];
    }

    const start = day * MINUTES_PER_DAY + window.startTime;
    const end = window.startTime < window.endTime
      ? day * MINUTES_PER_DAY + window.endTime
      : (day + 1) * MINUTES_PER_DAY + window.endTime;
    return [{ start, end }];
  });
};

export const intervalsOverlap = (
  left: { start: number; end: number },
  right: { start: number; end: number },
): boolean => {
  return [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK].some((shift) => {
    const shiftedRight = { start: right.start + shift, end: right.end + shift };
    return left.start < shiftedRight.end && shiftedRight.start < left.end;
  });
};

export const schedulesOverlapInTime = (candidate: ScheduleWindow, existing: ScheduleWindow): boolean => {
  const candidateIntervals = expandWeeklyIntervals(candidate);
  const existingIntervals = expandWeeklyIntervals(existing);
  return candidateIntervals.some((candidateInterval) => (
    existingIntervals.some((existingInterval) => intervalsOverlap(candidateInterval, existingInterval))
  ));
};

export const isScheduleActiveAt = (schedule: ScheduleWindow, dayOfWeek: number, currentTime: number): boolean => {
  const point = dayOfWeek * MINUTES_PER_DAY + currentTime;
  return expandWeeklyIntervals(schedule).some((interval) => (
    [point - MINUTES_PER_WEEK, point, point + MINUTES_PER_WEEK].some((shiftedPoint) => (
      interval.start <= shiftedPoint && shiftedPoint < interval.end
    ))
  ));
};
