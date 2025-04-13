import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { displayService } from '@/services/displayService';
import { hasFailedWith404 } from '@/services/displayState';
import { useConnectionState } from '@vizora/common/hooks/useConnectionStatus';

export interface Schedule {
  _id: string;
  contentId: string;
  startTime?: string;
  endTime?: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  priority: number;
  active: boolean;
  createdAt: string;
}

export interface DisplayWithStatus {
  id: string;
  name: string;
  location: string;
  deviceId?: string; // Make deviceId optional to accommodate API response
  status: 'online' | 'offline' | 'warning';
  lastPing?: string;
  ipAddress?: string;
  model?: string;
  scheduledContent?: Schedule[];
  activeSchedule?: Schedule;
  nextScheduledContent?: {
    title: string;
    startTime: string;
  } | null;
}

export function useDisplays() {
  const [displays, setDisplays] = useState<DisplayWithStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useConnectionState();
  
  // Use a ref to track processed displays to avoid duplicate fetches
  const processedDisplaysCache = useRef<Set<string>>(new Set());
  // Track displays that have been logged as skipped to avoid console spam
  const loggedSkippedDisplays = useRef<Set<string>>(new Set());

  const fetchDisplays = async () => {
    setLoading(true);
    setError(null);
    
    // Clear the cache when doing a fresh fetch
    processedDisplaysCache.current.clear();
    
    try {
      console.log('Fetching displays from API...');
      const response = await displayService.getDisplays();
      
      // Ensure we're always working with an array of displays
      let fetchedDisplays: DisplayWithStatus[] = [];
      
      // Handle different response formats gracefully
      if (response && typeof response === 'object') {
        if ('displays' in response && Array.isArray(response.displays)) {
          // Standard format: { displays: [...] }
          fetchedDisplays = response.displays as DisplayWithStatus[];
        } else if ('success' in response && response.success === true) {
          // Success format: { success: true, data: [...] }
          if ('data' in response && Array.isArray(response.data)) {
            fetchedDisplays = response.data as DisplayWithStatus[];
          }
        }
      } else if (Array.isArray(response)) {
        // Direct array format
        fetchedDisplays = response as DisplayWithStatus[];
      }
      
      // Safety check: ensure we have an array
      if (!Array.isArray(fetchedDisplays)) {
        console.warn('Unexpected response format from displays API. Converting to empty array:', response);
        fetchedDisplays = []; // Ensure we always have an array
      }
      
      console.log(`Processing ${fetchedDisplays.length} displays to add schedule information`);
      
      // Early return if no displays to avoid unnecessary processing
      if (fetchedDisplays.length === 0) {
        setDisplays([]);
        setLoading(false);
        return;
      }
      
      // Process display data to include schedule information
      const displaysWithScheduleInfo = await Promise.all(
        fetchedDisplays.map(async (display) => {
          if (!display || !display.id) {
            console.warn('Skipping invalid display object:', display);
            return null; // Will be filtered out later
          }
          
          // Skip processing for displays that are marked as failed/deleted
          if (hasFailedWith404(display.id)) {
            if (!loggedSkippedDisplays.current.has(display.id)) {
              console.log(`SKIP MONITORING: Display ${display.id} is marked as permanently failed or deleted`);
              loggedSkippedDisplays.current.add(display.id);
            }
            return null;
          }
          
          // Skip if we've already processed this display in this session
          if (processedDisplaysCache.current.has(display.id)) {
            if (!loggedSkippedDisplays.current.has(display.id)) {
              console.log(`SKIP DUPLICATE FETCH: Display ${display.id} has already been processed`);
              loggedSkippedDisplays.current.add(display.id);
            }
            // Find the already processed display and return it
            const existingDisplay = displays.find(d => d.id === display.id);
            return existingDisplay || display;
          }
          
          // Add to processed cache
          processedDisplaysCache.current.add(display.id);
          
          // Get the display's schedule
          try {
            // Only log the first time we fetch a schedule for a display
            if (!loggedSkippedDisplays.current.has(`schedule_${display.id}`)) {
              console.log(`Fetching schedule for display ${display.id}`);
              loggedSkippedDisplays.current.add(`schedule_${display.id}`);
            }
            
            const scheduleData = await displayService.getDisplaySchedule(display.id);
            
            // Validate schedule data
            const scheduledContent = Array.isArray(scheduleData.scheduledContent) 
              ? scheduleData.scheduledContent 
              : [];
            
            // Calculate the currently active schedule and next scheduled content
            const now = new Date();
            let activeSchedule: Schedule | undefined;
            let nextSchedule: Schedule | undefined;
            
            // Find active schedule (current time is between start and end times)
            const activeSchedules = scheduledContent.filter(schedule => {
              if (!schedule || !schedule.active) return false;
              
              const startTime = schedule.startTime ? new Date(schedule.startTime) : null;
              const endTime = schedule.endTime ? new Date(schedule.endTime) : null;
              
              // Check if current time is within schedule
              if (startTime && now < startTime) return false; // Not started yet
              if (endTime && now > endTime) return false; // Already ended
              
              // For recurring schedules, would need more logic here
              return true;
            });
            
            // If multiple active schedules, choose the one with the highest priority
            if (activeSchedules.length > 0) {
              activeSchedule = activeSchedules.sort((a, b) => b.priority - a.priority)[0];
            }
            
            // Find the next schedule that hasn't started yet
            const futureSchedules = scheduledContent
              .filter(schedule => {
                if (!schedule || !schedule.active) return false;
                if (!schedule.startTime) return false;
                return new Date(schedule.startTime) > now;
              })
              .sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
              });
            
            if (futureSchedules.length > 0) {
              nextSchedule = futureSchedules[0];
            }
            
            // Get the content title for the next schedule if available
            let nextScheduledContent = null;
            if (nextSchedule && nextSchedule.contentId) {
              try {
                const content = await displayService.getContentById(nextSchedule.contentId);
                if (content) {
                  nextScheduledContent = {
                    title: content.title || 'Untitled Content',
                    startTime: nextSchedule.startTime!
                  };
                }
              } catch (err) {
                console.warn('Could not fetch content title for scheduled content', err);
              }
            }
            
            return {
              ...display,
              scheduledContent,
              activeSchedule,
              nextScheduledContent
            };
          } catch (err) {
            // If schedule fetch fails, still include the display without schedule info
            console.warn(`Failed to fetch schedule for display ${display.id}:`, err);
            return display;
          }
        })
      );
      
      // Filter out any null values that might have come from invalid displays
      const validDisplays = displaysWithScheduleInfo.filter(
        (display): display is DisplayWithStatus => display !== null
      );
      
      console.log(`Finished processing ${validDisplays.length} displays with schedule information`);
      setDisplays(validDisplays);
    } catch (err) {
      console.error('Error fetching displays:', err);
      setError('Failed to fetch displays');
      // Set empty array to prevent mapping errors
      setDisplays([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch displays on first load and when connection status changes
  useEffect(() => {
    fetchDisplays();
  }, [isConnected]);

  // Original functions
  const pairDisplay = async (pairingCode: string, name: string, location: string) => {
    try {
      const response = await displayService.pairDisplay(pairingCode, name, location);
      
      // Only refetch if we have a valid response with deviceId
      if (response && response.id) {
        // Clear the processed cache to ensure we get fresh data
        processedDisplaysCache.current.clear();
        // Reset the logged skipped displays
        loggedSkippedDisplays.current.clear();
        
        // Fetch displays to refresh the list
        await fetchDisplays();
        return true;
      }
      
      // If no valid deviceId, pairing probably failed
      return false;
    } catch (err) {
      console.error('Error pairing display:', err);
      return false;
    }
  };

  const unpairDisplay = async (displayId: string) => {
    try {
      await displayService.unpairDisplay(displayId);
      toast.success('Display removed successfully');
      
      // Update displays list
      setDisplays(prevDisplays => prevDisplays.filter(d => d.id !== displayId));
      
      // Also remove from our caches
      processedDisplaysCache.current.delete(displayId);
      loggedSkippedDisplays.current.delete(displayId);
      loggedSkippedDisplays.current.delete(`schedule_${displayId}`);
      
      return true;
    } catch (err) {
      console.error('Error unpairing display:', err);
      toast.error('Failed to remove display');
      return false;
    }
  };

  const restartDisplay = async (displayId: string) => {
    try {
      await displayService.restartDisplay(displayId);
      return true;
    } catch (err) {
      console.error('Error restarting display:', err);
      return false;
    }
  };

  const updateDisplaySoftware = async (displayId: string) => {
    try {
      await displayService.updateDisplaySoftware(displayId);
      return true;
    } catch (err) {
      console.error('Error updating display software:', err);
      return false;
    }
  };

  return {
    displays,
    loading,
    error,
    fetchDisplays,
    pairDisplay,
    unpairDisplay,
    restartDisplay,
    updateDisplaySoftware
  };
} 