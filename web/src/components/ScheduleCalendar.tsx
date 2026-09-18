'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Calendar, dateFnsLocalizer, SlotInfo, View } from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  setHours,
  setMinutes,
} from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

interface Schedule {
  id: string;
  name: string;
  description?: string;
  startTime?: string | number;  // HH:MM string or minutes from midnight
  endTime?: string | number;    // HH:MM string or minutes from midnight
  daysOfWeek: number[];  // 0-6 (Sunday-Saturday)
  startDate?: string;
  endDate?: string;
  playlistId: string;
  displayId?: string;
  displayGroupId?: string;
  isActive: boolean;
  priority?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  days?: string[];
  deviceIds?: string[];
  duration?: number;
  timezone?: string;
  active?: boolean;
}

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: Schedule;
}

interface ScheduleCalendarProps {
  schedules: Schedule[];
  onSelectEvent: (schedule: Schedule) => void;
  onSelectSlot: (slotInfo: { start: Date; end: Date; daysOfWeek: number[] }) => void;
}

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function ScheduleCalendar({
  schedules,
  onSelectEvent,
  onSelectSlot,
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('month');

  const events = useMemo<CalendarEvent[]>(() => {
    const now = new Date();
    const windowStart = startOfMonth(subMonths(now, 2));
    const windowEnd = endOfMonth(addMonths(now, 2));
    const allDates = eachDayOfInterval({ start: windowStart, end: windowEnd });

    const calendarEvents: CalendarEvent[] = [];

    for (const schedule of schedules) {
      // Use current date as default if startDate is not set
      const scheduleStart = schedule.startDate ? new Date(schedule.startDate) : new Date();
      const scheduleEnd = schedule.endDate ? new Date(schedule.endDate) : null;

      for (const date of allDates) {
        const dayOfWeek = getDay(date);

        // Check if this day of week is in the schedule's daysOfWeek
        if (!schedule.daysOfWeek.includes(dayOfWeek)) continue;

        // Check if the date is within the schedule's date range
        if (date < scheduleStart) continue;
        if (scheduleEnd && date > scheduleEnd) continue;

        const isAllDay = !schedule.startTime && !schedule.endTime;

        if (isAllDay) {
          calendarEvents.push({
            title: schedule.name,
            start: date,
            end: date,
            allDay: true,
            resource: schedule,
          });
        } else {
          const startVal = schedule.startTime ?? '09:00';
          const [startH, startM] = typeof startVal === 'number'
            ? [Math.floor(startVal / 60), startVal % 60]
            : startVal.split(':').map(Number);
          const endVal = schedule.endTime ?? '10:00';
          const [endH, endM] = typeof endVal === 'number'
            ? [Math.floor(endVal / 60), endVal % 60]
            : endVal.split(':').map(Number);

          const eventStart = setMinutes(setHours(new Date(date), startH), startM);
          const eventEnd = setMinutes(setHours(new Date(date), endH), endM);

          calendarEvents.push({
            title: schedule.name,
            start: eventStart,
            end: eventEnd,
            allDay: false,
            resource: schedule,
          });
        }
      }
    }

    return calendarEvents;
  }, [schedules]);

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const schedule = event.resource;

    /*
     * Priority reads as WEIGHT, not as hue.
     *
     * The old ladder was grey -> green-500 -> neon, which put its two busiest
     * levels a few degrees apart and its top level at 1.65:1 on ivory. These
     * three step from a quiet limestone chip to brass to a solid forest block,
     * so the ordering survives a greyscale screenshot. Each fill carries an ink
     * measured against it: inactive 4.75:1, low 11.89:1, medium 4.79:1,
     * high 9.70:1.
     */
    if (!schedule.isActive) {
      return {
        style: {
          backgroundColor: 'var(--status-neutral-bg)',
          opacity: 0.6,
          color: 'var(--foreground-tertiary)',
          borderRadius: '4px',
          border: 'none',
        },
      };
    }

    // default / priority >= 3 / no priority
    let backgroundColor = 'var(--lw-forest)';
    let color = 'var(--lw-on-forest)';

    if (schedule.priority === 2) {
      backgroundColor = 'var(--accent-brass)';
      color = 'var(--lw-ink)';
    } else if (schedule.priority === 1) {
      backgroundColor = 'var(--background-tertiary)';
      color = 'var(--lw-ink)';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        border: 'none',
        color,
      },
    };
  }, []);

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onSelectEvent(event.resource);
    },
    [onSelectEvent]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      onSelectSlot({
        start: slotInfo.start,
        end: slotInfo.end,
        daysOfWeek: [getDay(slotInfo.start)],
      });
    },
    [onSelectSlot]
  );

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleViewChange = useCallback((view: View) => {
    setCurrentView(view);
  }, []);

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 schedule-calendar">
      {/* @ts-ignore -- styled-jsx types may or may not be available */}
      <style jsx global>{`
        .schedule-calendar .rbc-calendar {
          font-family: inherit;
          color: var(--foreground);
        }
        .schedule-calendar .rbc-header {
          padding: 8px 4px;
          /* Mono kicker, same role as .eh-th: a weekday strip is a column
             header, and the type scale gives those the mono face. */
          font-family: var(--font-mono), ui-monospace, monospace;
          font-weight: 500;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--foreground-tertiary);
          border-color: var(--border);
        }
        .schedule-calendar .rbc-month-view,
        .schedule-calendar .rbc-time-view,
        .schedule-calendar .rbc-agenda-view {
          border-color: var(--border);
          border-radius: 12px;
        }
        .schedule-calendar .rbc-month-row,
        .schedule-calendar .rbc-day-bg,
        .schedule-calendar .rbc-time-content,
        .schedule-calendar .rbc-time-header,
        .schedule-calendar .rbc-timeslot-group,
        .schedule-calendar .rbc-time-slot,
        .schedule-calendar .rbc-time-header-content {
          border-color: var(--border-light);
        }
        .schedule-calendar .rbc-toolbar button {
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.875rem;
          color: var(--foreground-secondary);
          border-color: var(--border);
        }
        .schedule-calendar .rbc-toolbar button:hover {
          background-color: var(--surface-hover);
          color: var(--foreground);
        }
        .schedule-calendar .rbc-toolbar button.rbc-active,
        .schedule-calendar .rbc-toolbar button.rbc-active:hover,
        .schedule-calendar .rbc-toolbar button.rbc-active:focus {
          background-color: var(--lw-forest);
          color: var(--lw-on-forest);
          border-color: var(--lw-forest);
        }
        .schedule-calendar .rbc-toolbar-label {
          font-family: var(--lw-serif);
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: var(--foreground);
        }
        .schedule-calendar .rbc-event {
          font-size: 0.75rem;
          padding: 2px 6px;
        }
        .schedule-calendar .rbc-today {
          /* Warm brand tint. Was #EFF6FF, a cool blue wash left over from
             react-big-calendar's own default sheet. */
          background-color: var(--badge-brand-bg);
        }
        .schedule-calendar .rbc-off-range-bg {
          background-color: var(--background-secondary);
        }
        .schedule-calendar .rbc-off-range {
          color: var(--foreground-tertiary);
        }
        .schedule-calendar .rbc-date-cell,
        .schedule-calendar .rbc-label {
          color: var(--foreground-secondary);
          font-variant-numeric: tabular-nums;
        }
        .schedule-calendar .rbc-current-time-indicator {
          background-color: var(--accent-coral-ink);
        }
        /*
         * NOTE: no backticks in this block. It is inside a template literal,
         * so one would end the CSS early and hand the rest to the parser as
         * JavaScript. That is how this file broke once already.
         *
         * The .dark .schedule-calendar block that used to sit here is GONE --
         * 13 rules and 18 hex literals of a second, cool-grey palette. Dark
         * mode was removed (plan section 3, D1) and .dark is never applied, so
         * none of it could render; leaving a complete competing skin in the
         * sheet for a stale bundle or an extension to land on is how a theme
         * comes back from the dead. globals.css deletes its .dark token block
         * for the same reason and says so.
         */
      `}</style>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        date={currentDate}
        view={currentView}
        onNavigate={handleNavigate}
        onView={handleViewChange}
        views={['month', 'week', 'day']}
        selectable
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        eventPropGetter={eventPropGetter}
        style={{ minHeight: 'calc(100vh - 250px)' }}
        popup
      />
    </div>
  );
}
