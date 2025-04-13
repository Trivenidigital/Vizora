import React from 'react';
import { Schedule, getActiveSchedules } from '@vizora/common';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduleTimelineProps {
  schedules: Schedule[];
  currentTime?: Date;
  className?: string;
  onScheduleClick?: (schedule: Schedule) => void;
}

export function ScheduleTimeline({
  schedules,
  currentTime = new Date(),
  className,
  onScheduleClick
}: ScheduleTimelineProps) {
  // Get active schedules
  const activeSchedules = getActiveSchedules(schedules);
  
  // Calculate timeline range (24 hours from current time)
  const timelineStart = new Date(currentTime);
  timelineStart.setHours(0, 0, 0, 0);
  
  const timelineEnd = new Date(timelineStart);
  timelineEnd.setDate(timelineEnd.getDate() + 1);
  
  // Generate time markers
  const timeMarkers = Array.from({ length: 24 }, (_, i) => {
    const time = new Date(timelineStart);
    time.setHours(i);
    return time;
  });
  
  // Calculate schedule positions
  const getSchedulePosition = (schedule: Schedule) => {
    const start = new Date(schedule.startTime);
    const end = schedule.endTime ? new Date(schedule.endTime) : new Date(start.getTime() + 3600000);
    
    const startPercent = ((start.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
    const endPercent = ((end.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
    
    return {
      left: `${Math.max(0, startPercent)}%`,
      width: `${Math.min(100, endPercent) - Math.max(0, startPercent)}%`
    };
  };
  
  // Get schedule color based on priority
  const getScheduleColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-blue-100 border-blue-200';
      case 2: return 'bg-green-100 border-green-200';
      case 3: return 'bg-amber-100 border-amber-200';
      case 4: return 'bg-orange-100 border-orange-200';
      case 5: return 'bg-red-100 border-red-200';
      default: return 'bg-gray-100 border-gray-200';
    }
  };
  
  return (
    <div className={cn("relative w-full h-64 bg-white rounded-lg border p-4", className)}>
      {/* Time markers */}
      <div className="absolute top-0 left-0 right-0 h-8 flex">
        {timeMarkers.map((time, index) => (
          <div
            key={index}
            className="flex-1 text-xs text-gray-500 text-center border-r border-gray-200"
          >
            {format(time, 'HH:mm')}
          </div>
        ))}
      </div>
      
      {/* Current time indicator */}
      <div
        className="absolute top-8 bottom-0 w-px bg-red-500"
        style={{
          left: `${((currentTime.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100}%`
        }}
      >
        <div className="absolute -top-2 -left-1 w-2 h-2 rounded-full bg-red-500" />
      </div>
      
      {/* Schedule bars */}
      <div className="absolute top-8 left-0 right-0 bottom-0">
        {activeSchedules.map((schedule) => {
          const position = getSchedulePosition(schedule);
          return (
            <div
              key={schedule.id}
              className={cn(
                "absolute h-8 rounded border cursor-pointer hover:opacity-90 transition-opacity",
                getScheduleColor(schedule.priority || 1)
              )}
              style={{
                left: position.left,
                width: position.width,
                top: `${(schedule.priority || 1) * 10}px`
              }}
              onClick={() => onScheduleClick?.(schedule)}
            >
              <div className="px-2 py-1 text-xs truncate">
                {schedule.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 