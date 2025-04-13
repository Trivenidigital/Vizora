import { useState, useEffect, useCallback, useMemo } from 'react';
import { scheduleService } from '@/services/scheduleService';
import { useConnectionState } from '@vizora/common/hooks/useConnectionStatus';

// Re-export the Schedule interface for components to use
export interface Schedule {
  id: string;
  name: string;
  description?: string;
  type: 'display' | 'group';
  targetId: string;
  content: {
    id: string;
    name: string;
    type: string;
    duration: number;
    startTime: string;
    endTime: string;
  }[];
  timezone: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string;
  priority: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

export interface ScheduleFilters {
  type?: Schedule['type'];
  status?: Schedule['status'];
  targetId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ScheduleFormData {
  name: string;
  description?: string;
  type: 'display' | 'group';
  targetId: string;
  content: {
    id: string;
    name: string;
    type: string;
    duration: number;
    startTime: string;
    endTime: string;
  }[];
  timezone: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string;
  priority: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}

export function useSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ScheduleFilters>({});
  const [totalCount, setTotalCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    paused: number;
    completed: number;
    cancelled: number;
  } | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const { isConnected } = useConnectionState();

  // Cache expiration time - 5 minutes
  const CACHE_EXPIRATION = 5 * 60 * 1000;

  // Check if cache is expired
  const isCacheExpired = useCallback(() => {
    if (!lastFetched) return true;
    return Date.now() - lastFetched > CACHE_EXPIRATION;
  }, [lastFetched]);

  // Fetch schedules with caching
  const fetchSchedules = useCallback(async (forceRefresh = false) => {
    // Return cached data if available and not expired
    if (!forceRefresh && !isCacheExpired() && schedules.length > 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await scheduleService.getSchedules(filters);
      setSchedules(response.schedules);
      setFilteredSchedules(response.schedules);
      setTotalCount(response.total);
      setLastFetched(Date.now());
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setError('Failed to load schedules. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, isCacheExpired, schedules.length]);

  // Fetch schedule stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    
    try {
      const statsData = await scheduleService.getScheduleStats();
      setStats({
        total: statsData.total,
        active: statsData.active,
        paused: statsData.paused,
        completed: statsData.completed,
        cancelled: statsData.cancelled
      });
    } catch (error) {
      console.error('Error fetching schedule stats:', error);
      // Don't set error state, as this is supplementary data
    } finally {
      setStatsLoading(false);
    }
  }, []);
  
  // Initial fetch when connected
  useEffect(() => {
    if (isConnected) {
      fetchSchedules();
      fetchStats();
    }
  }, [isConnected, fetchSchedules, fetchStats]);

  // Apply filters client-side
  useEffect(() => {
    if (schedules.length > 0) {
      let filtered = [...schedules];
      
      if (filters.type) {
        filtered = filtered.filter(schedule => schedule.type === filters.type);
      }
      
      if (filters.status) {
        filtered = filtered.filter(schedule => schedule.status === filters.status);
      }
      
      if (filters.targetId) {
        filtered = filtered.filter(schedule => schedule.targetId === filters.targetId);
      }
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        filtered = filtered.filter(schedule => new Date(schedule.startDate) >= startDate);
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        filtered = filtered.filter(schedule => 
          !schedule.endDate || new Date(schedule.endDate) <= endDate
        );
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(schedule => 
          schedule.name.toLowerCase().includes(search) || 
          (schedule.description && schedule.description.toLowerCase().includes(search))
        );
      }
      
      setFilteredSchedules(filtered);
    }
  }, [schedules, filters]);

  // Create a schedule
  const createSchedule = useCallback(async (data: ScheduleFormData): Promise<Schedule | null> => {
    try {
      const newSchedule = await scheduleService.createSchedule(data);
      setSchedules(prev => [...prev, newSchedule]);
      return newSchedule;
    } catch (error) {
      console.error('Error creating schedule:', error);
      return null;
    }
  }, []);

  // Update a schedule
  const updateSchedule = useCallback(async (id: string, data: Partial<Schedule>): Promise<Schedule | null> => {
    try {
      const updatedSchedule = await scheduleService.updateSchedule(id, data);
      setSchedules(prev => 
        prev.map(schedule => schedule.id === id ? updatedSchedule : schedule)
      );
      return updatedSchedule;
    } catch (error) {
      console.error('Error updating schedule:', error);
      return null;
    }
  }, []);

  // Delete a schedule
  const deleteSchedule = useCallback(async (id: string): Promise<boolean> => {
    try {
      await scheduleService.deleteSchedule(id);
      setSchedules(prev => prev.filter(schedule => schedule.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting schedule:', error);
      return false;
    }
  }, []);

  // Pause a schedule
  const pauseSchedule = useCallback(async (id: string): Promise<Schedule | null> => {
    try {
      const updatedSchedule = await scheduleService.pauseSchedule(id);
      setSchedules(prev => 
        prev.map(schedule => schedule.id === id ? updatedSchedule : schedule)
      );
      return updatedSchedule;
    } catch (error) {
      console.error('Error pausing schedule:', error);
      return null;
    }
  }, []);

  // Resume a schedule
  const resumeSchedule = useCallback(async (id: string): Promise<Schedule | null> => {
    try {
      const updatedSchedule = await scheduleService.resumeSchedule(id);
      setSchedules(prev => 
        prev.map(schedule => schedule.id === id ? updatedSchedule : schedule)
      );
      return updatedSchedule;
    } catch (error) {
      console.error('Error resuming schedule:', error);
      return null;
    }
  }, []);

  // Cancel a schedule
  const cancelSchedule = useCallback(async (id: string): Promise<Schedule | null> => {
    try {
      const updatedSchedule = await scheduleService.cancelSchedule(id);
      setSchedules(prev => 
        prev.map(schedule => schedule.id === id ? updatedSchedule : schedule)
      );
      return updatedSchedule;
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      return null;
    }
  }, []);

  // Duplicate a schedule
  const duplicateSchedule = useCallback(async (id: string): Promise<Schedule | null> => {
    try {
      const newSchedule = await scheduleService.duplicateSchedule(id);
      setSchedules(prev => [...prev, newSchedule]);
      return newSchedule;
    } catch (error) {
      console.error('Error duplicating schedule:', error);
      return null;
    }
  }, []);

  // Get active schedules
  const activeSchedules = useMemo(() => {
    return filteredSchedules.filter(schedule => schedule.status === 'active');
  }, [filteredSchedules]);

  // Get upcoming schedules (active with future start dates)
  const upcomingSchedules = useMemo(() => {
    const now = new Date();
    return filteredSchedules.filter(schedule => 
      schedule.status === 'active' && new Date(schedule.startDate) > now
    );
  }, [filteredSchedules]);

  // Update filters
  const updateFilters = useCallback((newFilters: ScheduleFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    schedules: filteredSchedules,
    allSchedules: schedules,
    activeSchedules,
    upcomingSchedules,
    loading,
    error,
    stats,
    statsLoading,
    filters,
    totalCount,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    pauseSchedule,
    resumeSchedule,
    cancelSchedule,
    duplicateSchedule,
    updateFilters,
    clearFilters
  };
} 