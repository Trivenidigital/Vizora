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
  startTime?: string;  // HH:MM
  endTime?: string;    // HH:MM
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
          const [startH, startM] = (schedule.startTime || '09:00').split(':').map(Number);
          const [endH, endM] = (schedule.endTime || '10:00').split(':').map(Number);

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

    if (!schedule.isActive) {
      return {
        style: {
          backgroundColor: '#D1D5DB', // gray-300
          opacity: 0.6,
          color: '#6B7280',
          borderRadius: '4px',
          border: 'none',
        },
      };
    }

    let backgroundColor = '#00E5A0'; // brand green (default / priority >= 3 / no priority)

    if (schedule.priority === 2) {
      backgroundColor = '#22C55E'; // green-500
    } else if (schedule.priority === 1) {
      backgroundColor = '#6B7280'; // gray-500
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        border: 'none',
        color: '#061A21',
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
      <style jsx global>{`
        .schedule-calendar .rbc-calendar {
          font-family: inherit;
        }
        .schedule-calendar .rbc-header {
          padding: 8px 4px;
          font-weight: 600;
          font-size: 0.875rem;
        }
        .schedule-calendar .rbc-toolbar button {
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.875rem;
        }
        .schedule-calendar .rbc-toolbar button:hover {
          background-color: #E5E7EB;
        }
        .schedule-calendar .rbc-toolbar button.rbc-active {
          background-color: #00E5A0;
          color: #061A21;
        }
        .schedule-calendar .rbc-toolbar button.rbc-active:hover {
          background-color: #00CC8E;
        }
        .schedule-calendar .rbc-event {
          font-size: 0.75rem;
          padding: 2px 6px;
        }
        .schedule-calendar .rbc-today {
          background-color: #EFF6FF;
        }
        .dark .schedule-calendar .rbc-header {
          color: #F9FAFB;
          border-color: #374151;
        }
        .dark .schedule-calendar .rbc-toolbar button {
          color: #D1D5DB;
          border-color: #4B5563;
        }
        .dark .schedule-calendar .rbc-toolbar button:hover {
          background-color: #374151;
        }
        .dark .schedule-calendar .rbc-toolbar button.rbc-active {
          background-color: #00E5A0;
          color: #061A21;
        }
        .dark .schedule-calendar .rbc-today {
          background-color: #1E293B;
        }
        .dark .schedule-calendar .rbc-off-range-bg {
          background-color: #111827;
        }
        .dark .schedule-calendar .rbc-month-view,
        .dark .schedule-calendar .rbc-time-view,
        .dark .schedule-calendar .rbc-agenda-view {
          background-color: #111827;
          border-color: #374151;
        }
        .dark .schedule-calendar .rbc-month-row,
        .dark .schedule-calendar .rbc-day-bg,
        .dark .schedule-calendar .rbc-time-content,
        .dark .schedule-calendar .rbc-time-header,
        .dark .schedule-calendar .rbc-timeslot-group {
          border-color: #374151;
        }
        .dark .schedule-calendar .rbc-date-cell {
          color: #D1D5DB;
        }
        .dark .schedule-calendar .rbc-off-range {
          color: #6B7280;
        }
        .dark .schedule-calendar .rbc-toolbar-label {
          color: #F9FAFB;
        }
        .dark .schedule-calendar .rbc-time-slot {
          border-color: #374151;
        }
        .dark .schedule-calendar .rbc-label {
          color: #9CA3AF;
        }
        .dark .schedule-calendar .rbc-current-time-indicator {
          background-color: #EF4444;
        }
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
