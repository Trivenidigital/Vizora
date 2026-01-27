/**
 * Checks if a date is in the past
 */
export function isPastDate(date: Date): boolean {
  return date < new Date();
}

/**
 * Checks if current time is within a time slot
 */
export function isWithinTimeSlot(
  startTime: string,
  endTime: string,
  currentTime: Date = new Date()
): boolean {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const current = currentTime.getHours() * 60 + currentTime.getMinutes();
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  return current >= start && current <= end;
}

/**
 * Checks if current date is within date range
 */
export function isWithinDateRange(
  startDate?: Date,
  endDate?: Date,
  currentDate: Date = new Date()
): boolean {
  if (startDate && currentDate < startDate) return false;
  if (endDate && currentDate > endDate) return false;
  return true;
}

/**
 * Adds minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}
