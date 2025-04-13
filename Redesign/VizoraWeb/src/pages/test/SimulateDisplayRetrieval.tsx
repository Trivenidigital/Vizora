import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Schedule, 
  ContentWithSchedule,
  isScheduleActive,
  getActiveSchedules,
  getHighestPrioritySchedule,
  processScheduledContent
} from '@vizora/common';
import { ScheduleDisplay } from '@/components/schedule';

interface ContentItem {
  id: string;
  contentId: string;
  title: string;
  url: string;
  type: string;
  duration: number;
  scheduled?: boolean;
  scheduledInfo?: {
    startTime: string;
    endTime: string;
    repeat: string;
    priority: number;
  };
  displaySettings: {
    autoplay: boolean;
    loop: boolean;
    mute: boolean;
    fit: string;
  };
}

/**
 * SimulateDisplayRetrieval - A test component that simulates a TV device retrieving content
 * This helps test the content scheduling without needing an actual TV device
 */
const SimulateDisplayRetrieval: React.FC = () => {
  const [deviceId, setDeviceId] = useState<string>(`test-device-${Date.now()}`);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [activeContent, setActiveContent] = useState<ContentItem | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [pollingInterval, setPollingInterval] = useState<number>(10);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [nextSchedule, setNextSchedule] = useState<Schedule | null>(null);

  const navigate = useNavigate();

  // Add a log message with timestamp
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 49)]);
  };

  // Fetch content from the server
  const fetchContent = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      addLog(`Fetching content for device ${deviceId}...`);
      
      const response = await fetch(`/api/displays/${deviceId}/content`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setContent(data.content || []);
        setLastFetched(new Date());
        
        addLog(`Retrieved ${data.content?.length || 0} content items`);
        
        // Extract schedules from content items
        const extractedSchedules: Schedule[] = [];
        data.content?.forEach((item: ContentItem) => {
          if (item.scheduled && item.scheduledInfo) {
            const schedule: Schedule = {
              id: `schedule-${item.id}`,
              name: `Schedule for ${item.title}`,
              contentId: item.contentId,
              displayId: deviceId,
              startTime: item.scheduledInfo.startTime,
              endTime: item.scheduledInfo.endTime,
              repeat: item.scheduledInfo.repeat as 'none' | 'daily' | 'weekly' | 'monthly',
              priority: item.scheduledInfo.priority,
              active: true,
              createdAt: new Date().toISOString()
            };
            extractedSchedules.push(schedule);
          }
        });
        
        setSchedules(extractedSchedules);
        
        // Determine active content based on schedule
        determineActiveContent(data.content || []);
      } else {
        setError(data.message || 'Failed to fetch content');
        addLog(`Error: ${data.message || 'Failed to fetch content'}`);
      }
    } catch (err) {
      console.error('Error fetching content:', err);
      setError('Failed to connect to server');
      addLog('Error: Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine which content should be active based on schedules
  const determineActiveContent = (contentItems: ContentItem[]) => {
    if (!contentItems.length) {
      setActiveContent(null);
      addLog('No content available');
      return;
    }
    
    // Get current time
    const now = new Date();
    
    // Prepare data structure for processScheduledContent
    const contentWithSchedule: ContentWithSchedule[] = contentItems.map(item => {
      const result: ContentWithSchedule = {
        id: item.id,
        title: item.title,
        type: item.type as any,
        url: item.url,
        scheduled: item.scheduled || false
      };
      
      if (item.scheduled && item.scheduledInfo) {
        result.scheduledInfo = {
          startTime: item.scheduledInfo.startTime,
          endTime: item.scheduledInfo.endTime,
          repeat: item.scheduledInfo.repeat as any,
          priority: item.scheduledInfo.priority
        };
      }
      
      return result;
    });
    
    // Use centralized schedule processing
    const { activeContent: activeScheduledContent, nextContent } = processScheduledContent(contentWithSchedule, now);
    
    // Update active and next schedules
    const activeSchedules = getActiveSchedules(schedules, now);
    const highestPrioritySchedule = getHighestPrioritySchedule(schedules, now);
    
    setActiveSchedule(highestPrioritySchedule || null);
    setNextSchedule(getNextSchedule(schedules, now) || null);
    
    if (activeScheduledContent) {
      // Find the matching original content item with full details
      const matchingContentItem = contentItems.find(item => item.id === activeScheduledContent.id);
      
      if (matchingContentItem) {
        setActiveContent(matchingContentItem);
        addLog(`Playing scheduled content: ${matchingContentItem.title}`);
        
        if (activeSchedules.length > 1) {
          addLog(`Multiple active schedules (${activeSchedules.length}). Using highest priority.`);
        }
      }
    } else if (contentItems.length > 0) {
      // Fallback to regular content
      const regularContent = contentItems.find(item => !item.scheduled);
      
      if (regularContent) {
        setActiveContent(regularContent);
        addLog(`Playing regular content: ${regularContent.title}`);
      } else {
        // If all content is scheduled but none active, show the first item
        setActiveContent(contentItems[0]);
        addLog(`No active schedule, showing first content: ${contentItems[0].title}`);
      }
    } else {
      setActiveContent(null);
      addLog('No content to display');
    }
  };

  // Toggle content polling
  const togglePolling = () => {
    if (isPolling) {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
      setIsPolling(false);
      addLog('Polling stopped');
    } else {
      fetchContent(); // Fetch immediately
      
      const id = setInterval(() => {
        fetchContent();
      }, pollingInterval * 1000);
      
      setIntervalId(id);
      setIsPolling(true);
      addLog(`Polling started at ${pollingInterval} second intervals`);
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  // Register the device when component mounts
  useEffect(() => {
    // Simulate device registration
    const registerDevice = async () => {
      try {
        addLog('Registering test device...');
        
        const response = await fetch('/api/devices/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            deviceId,
            name: 'Test TV Device',
            model: 'Vizora Simulator',
            type: 'VizoraTV'
          })
        });
        
        if (response.ok) {
          addLog('Device registered successfully');
          fetchContent();
        } else {
          const data = await response.json();
          addLog(`Device registration failed: ${data.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Error registering device:', err);
        addLog('Error registering device');
      }
    };
    
    registerDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Vizora TV Simulator</h1>
          <div className="space-x-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/test-pairing')}
            >
              Pairing Screen
            </Button>
            <Button
              variant="primary"
              onClick={fetchContent}
              disabled={isLoading}
            >
              Refresh Content
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Display Panel */}
          <div className="col-span-2">
            <Card className="h-full">
              <div className="flex flex-col h-full">
                <h2 className="text-xl font-semibold mb-4">Content Playback Simulator</h2>
                
                {isLoading ? (
                  <div className="flex-grow flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                  </div>
                ) : activeContent ? (
                  <div className="flex-grow flex flex-col">
                    <div className="bg-gray-800 rounded-md flex-grow relative flex items-center justify-center">
                      {activeContent.type === 'image' ? (
                        <img 
                          src={activeContent.url} 
                          alt={activeContent.title}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : activeContent.type === 'video' ? (
                        <video
                          src={activeContent.url}
                          controls
                          autoPlay={activeContent.displaySettings?.autoplay}
                          loop={activeContent.displaySettings?.loop}
                          muted={activeContent.displaySettings?.mute}
                          className="max-h-full max-w-full"
                        />
                      ) : (
                        <div className="text-white">
                          Cannot display content type: {activeContent.type}
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{activeContent.title}</div>
                            <div className="text-xs opacity-70">
                              {activeContent.scheduled && activeSchedule ? 'Scheduled Content' : 'Regular Content'}
                            </div>
                          </div>
                          <div className="text-xs">
                            ID: {activeContent.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">Content Details</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Title:</span> {activeContent.title}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {activeContent.type}
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span> {activeContent.duration}s
                        </div>
                        <div>
                          <span className="font-medium">Loop:</span> {activeContent.displaySettings?.loop ? 'Yes' : 'No'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Show active schedule if available */}
                    {activeContent.scheduled && activeSchedule && (
                      <div className="mt-4">
                        <h3 className="text-sm font-medium mb-2">Active Schedule</h3>
                        <ScheduleDisplay 
                          schedule={activeSchedule}
                          isActive={true}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-grow flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-gray-500 mb-2">No content available</div>
                      <Button
                        variant="primary"
                        onClick={fetchContent}
                        disabled={isLoading}
                      >
                        Reload Content
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
          
          {/* Sidebar with Controls and Status */}
          <div className="col-span-1 space-y-6">
            <Card>
              <h2 className="text-xl font-semibold mb-4">Device Controls</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Device ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setDeviceId(`test-device-${Date.now()}`)}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Polling Interval (seconds)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={pollingInterval}
                      onChange={(e) => setPollingInterval(parseInt(e.target.value) || 10)}
                      min={5}
                      max={60}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <Button
                      variant={isPolling ? "secondary" : "primary"}
                      onClick={togglePolling}
                    >
                      {isPolling ? "Stop" : "Start"} Polling
                    </Button>
                  </div>
                </div>
                
                <div className="pt-2">
                  <div className="flex justify-between text-sm">
                    <span>Last Update:</span>
                    <span>{formatDate(lastFetched)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Content Items:</span>
                    <span>{content.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Schedules:</span>
                    <span>{schedules.length}</span>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* Next Schedule Card */}
            {nextSchedule && (
              <Card>
                <h2 className="text-xl font-semibold mb-4">Up Next</h2>
                <ScheduleDisplay 
                  schedule={nextSchedule}
                  isNext={true}
                />
              </Card>
            )}
            
            {/* Log Output */}
            <Card>
              <h2 className="text-xl font-semibold mb-2">Event Log</h2>
              <div className="bg-gray-900 text-gray-100 p-3 rounded-md h-64 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-gray-500">No events logged</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulateDisplayRetrieval; 