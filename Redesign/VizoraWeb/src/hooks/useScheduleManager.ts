import { useState, useEffect, useCallback } from 'react';
import { 
  Schedule, 
  ScheduleInfo, 
  ScheduleValidationResult,
  isScheduleActive,
  getActiveSchedules,
  getHighestPrioritySchedule,
  getNextSchedule,
  validateSchedule
} from '@vizora/common';
import { useToast } from '@/hooks/useToast';

interface ScheduleManagerOptions {
  initialSchedules?: Schedule[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  onActiveScheduleChanged?: (schedule: Schedule | null) => void;
  onNextScheduleChanged?: (schedule: Schedule | null) => void;
  validateOnAdd?: boolean;
}

export function useScheduleManager(options: ScheduleManagerOptions = {}) {
  const {
    initialSchedules = [],
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    onActiveScheduleChanged,
    onNextScheduleChanged,
    validateOnAdd = true
  } = options;

  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [nextSchedule, setNextSchedule] = useState<Schedule | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  // Update schedules
  const updateSchedules = useCallback((newSchedules: Schedule[]) => {
    setSchedules(newSchedules);
  }, []);

  // Add a new schedule
  const addSchedule = useCallback((newSchedule: Schedule): ScheduleValidationResult => {
    let validationResult: ScheduleValidationResult = { valid: true, errors: [], overlaps: [] };
    
    if (validateOnAdd) {
      validationResult = validateSchedule(newSchedule, schedules);
      
      if (!validationResult.valid) {
        return validationResult;
      }
    }
    
    setSchedules(prev => [...prev, newSchedule]);
    return validationResult;
  }, [schedules, validateOnAdd]);

  // Remove a schedule
  const removeSchedule = useCallback((scheduleId: string) => {
    setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
  }, []);

  // Update a schedule
  const updateSchedule = useCallback((updatedSchedule: Schedule): ScheduleValidationResult => {
    let validationResult: ScheduleValidationResult = { valid: true, errors: [], overlaps: [] };
    
    if (validateOnAdd) {
      // Validate against all schedules except the one being updated
      const otherSchedules = schedules.filter(s => s.id !== updatedSchedule.id);
      validationResult = validateSchedule(updatedSchedule, otherSchedules);
      
      if (!validationResult.valid) {
        return validationResult;
      }
    }
    
    setSchedules(prev => 
      prev.map(schedule => 
        schedule.id === updatedSchedule.id ? updatedSchedule : schedule
      )
    );
    
    return validationResult;
  }, [schedules, validateOnAdd]);

  // Check if a schedule is active
  const isActive = useCallback((schedule: Schedule | ScheduleInfo): boolean => {
    return isScheduleActive(schedule, currentTime);
  }, [currentTime]);

  // Get all active schedules
  const getActive = useCallback((): Schedule[] => {
    return getActiveSchedules(schedules, currentTime);
  }, [schedules, currentTime]);

  // Refresh the current time and schedule states
  const refreshScheduleStatus = useCallback(() => {
    const now = new Date();
    setCurrentTime(now);
    
    const highestPrioritySchedule = getHighestPrioritySchedule(schedules, now);
    const nextActiveSchedule = getNextSchedule(schedules, now);
    
    // Update active schedule if it changed
    if (highestPrioritySchedule !== activeSchedule) {
      setActiveSchedule(highestPrioritySchedule || null);
      if (onActiveScheduleChanged) {
        onActiveScheduleChanged(highestPrioritySchedule || null);
      }
    }
    
    // Update next schedule if it changed
    if (nextActiveSchedule !== nextSchedule) {
      setNextSchedule(nextActiveSchedule || null);
      if (onNextScheduleChanged) {
        onNextScheduleChanged(nextActiveSchedule || null);
      }
    }
  }, [schedules, activeSchedule, nextSchedule, onActiveScheduleChanged, onNextScheduleChanged]);

  // Auto refresh based on next schedule time
  useEffect(() => {
    refreshScheduleStatus();
    
    if (!autoRefresh) return;
    
    // Set up refresh interval
    const intervalId = setInterval(() => {
      refreshScheduleStatus();
    }, refreshInterval);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [refreshScheduleStatus, autoRefresh, refreshInterval]);

  // Format schedule time for display
  const formatScheduleTime = useCallback((date: string | Date): string => {
    const scheduleDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    
    // If it's today, just show the time
    if (scheduleDate.toDateString() === now.toDateString()) {
      return `Today at ${scheduleDate.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    
    // If it's tomorrow, show "Tomorrow at TIME"
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (scheduleDate.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${scheduleDate.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    
    // Otherwise show date and time
    return scheduleDate.toLocaleString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);

  return {
    schedules,
    activeSchedule,
    nextSchedule,
    currentTime,
    updateSchedules,
    addSchedule,
    removeSchedule,
    updateSchedule,
    isActive,
    getActive,
    refreshScheduleStatus,
    formatScheduleTime
  };
} 