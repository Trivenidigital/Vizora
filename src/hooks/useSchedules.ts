import { useState, useEffect, useCallback } from 'react';
import { scheduleService } from '@/services/scheduleService';
import toast from 'react-hot-toast';

export interface Schedule {
  _id: string;
  name: string;
  displayId: string;
  displayName: string;
  contentId: string;
  contentName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
  repeat: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleFormData {
  name: string;
  displayId: string;
  contentId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
  repeat: string;
  priority: number;
}

export const useSchedules = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await scheduleService.getSchedules();
      // Map the API response to our Schedule interface
      const formattedSchedules = response.schedules.map(schedule => ({
        _id: schedule.id,
        name: schedule.name,
        displayId: schedule.targetId,
        displayName: schedule.type === 'display' ? schedule.name : 'Unknown Display',
        contentId: schedule.content[0]?.id || '',
        contentName: schedule.content[0]?.name || 'No Content',
        startDate: schedule.startDate,
        endDate: schedule.endDate || '',
        startTime: schedule.content[0]?.startTime || '00:00',
        endTime: schedule.content[0]?.endTime || '23:59',
        daysOfWeek: schedule.daysOfWeek ? 
          schedule.daysOfWeek.map(day => {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            return days[day] || '';
          }).filter(Boolean) : [],
        repeat: schedule.repeat,
        priority: schedule.priority,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
      }));
      
      setSchedules(formattedSchedules);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schedules');
      toast.error('Failed to load schedules');
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSchedule = async (scheduleData: ScheduleFormData): Promise<Schedule | null> => {
    try {
      // Convert our form data to match the API's expected format
      const apiScheduleData = {
        name: scheduleData.name,
        type: 'display' as const,
        targetId: scheduleData.displayId,
        content: [{
          id: scheduleData.contentId,
          name: '', // This will be filled by the API
          type: '', // This will be filled by the API
          duration: 0, // This will be filled by the API
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
        }],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        repeat: scheduleData.repeat as 'none' | 'daily' | 'weekly' | 'monthly',
        daysOfWeek: scheduleData.daysOfWeek.map(day => {
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          return days.indexOf(day);
        }).filter(idx => idx !== -1),
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate,
        priority: scheduleData.priority,
        status: 'active' as const,
      };

      const response = await scheduleService.createSchedule(apiScheduleData);
      
      // Convert response to our Schedule format
      const newSchedule: Schedule = {
        _id: response.id,
        name: response.name,
        displayId: response.targetId,
        displayName: response.type === 'display' ? response.name : 'Unknown Display',
        contentId: response.content[0]?.id || '',
        contentName: response.content[0]?.name || 'No Content',
        startDate: response.startDate,
        endDate: response.endDate || '',
        startTime: response.content[0]?.startTime || '00:00',
        endTime: response.content[0]?.endTime || '23:59',
        daysOfWeek: response.daysOfWeek ? 
          response.daysOfWeek.map(day => {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            return days[day] || '';
          }).filter(Boolean) : [],
        repeat: response.repeat,
        priority: response.priority,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      };

      // Update the local state
      setSchedules(prev => [...prev, newSchedule]);
      toast.success('Schedule created successfully');
      return newSchedule;
    } catch (err) {
      toast.error('Failed to create schedule');
      console.error('Error creating schedule:', err);
      return null;
    }
  };

  const updateSchedule = async (id: string, scheduleData: ScheduleFormData): Promise<Schedule | null> => {
    try {
      // Convert our form data to match the API's expected format
      const apiScheduleData = {
        name: scheduleData.name,
        targetId: scheduleData.displayId,
        content: [{
          id: scheduleData.contentId,
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
        }],
        repeat: scheduleData.repeat as 'none' | 'daily' | 'weekly' | 'monthly',
        daysOfWeek: scheduleData.daysOfWeek.map(day => {
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          return days.indexOf(day);
        }).filter(idx => idx !== -1),
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate,
        priority: scheduleData.priority
      };

      const response = await scheduleService.updateSchedule(id, apiScheduleData);
      
      // Convert response to our Schedule format
      const updatedSchedule: Schedule = {
        _id: response.id,
        name: response.name,
        displayId: response.targetId,
        displayName: response.type === 'display' ? response.name : 'Unknown Display',
        contentId: response.content[0]?.id || '',
        contentName: response.content[0]?.name || 'No Content',
        startDate: response.startDate,
        endDate: response.endDate || '',
        startTime: response.content[0]?.startTime || '00:00',
        endTime: response.content[0]?.endTime || '23:59',
        daysOfWeek: response.daysOfWeek ? 
          response.daysOfWeek.map(day => {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            return days[day] || '';
          }).filter(Boolean) : [],
        repeat: response.repeat,
        priority: response.priority,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      };

      // Update the local state
      setSchedules(prev => prev.map(schedule => 
        schedule._id === id ? updatedSchedule : schedule
      ));
      
      toast.success('Schedule updated successfully');
      return updatedSchedule;
    } catch (err) {
      toast.error('Failed to update schedule');
      console.error('Error updating schedule:', err);
      return null;
    }
  };

  const deleteSchedule = async (id: string): Promise<boolean> => {
    try {
      await scheduleService.deleteSchedule(id);
      
      // Update the local state
      setSchedules(prev => prev.filter(schedule => schedule._id !== id));
      
      toast.success('Schedule deleted successfully');
      return true;
    } catch (err) {
      toast.error('Failed to delete schedule');
      console.error('Error deleting schedule:', err);
      return false;
    }
  };

  // Load schedules on component mount
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    loading,
    error,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule
  };
}; 