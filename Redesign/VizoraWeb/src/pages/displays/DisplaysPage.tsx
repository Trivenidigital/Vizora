import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useDisplays, DisplayWithStatus } from '@/hooks/useDisplays';
import AddDisplayDialog from '@/components/AddDisplayDialog';
import { PushContentDialog } from '@/components/PushContentDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatRelativeTime } from '@/utils/formatters';
import { displayPollingService, isDisplayDeleted, hasFailedWith404 } from '@/services/displayPollingService';
import { ScheduleDisplay } from '@/components/schedule';
import { 
  WifiIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  CalendarIcon,
  PlayCircleIcon,
  ArrowPathIcon, 
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

const DisplaysPage = () => {
  // Helper function to safely render objects or complex types
  const safeString = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'object') {
      // If it's an object, return a reasonable string representation
      try {
        if (Array.isArray(value)) {
          return value.map(safeString).join(', ');
        }
        // Handle specific known object types
        if ('name' in value && typeof value.name === 'string') {
          return value.name;
        }
        if ('title' in value && typeof value.title === 'string') {
          return value.title;
        }
        if ('id' in value && typeof value.id === 'string') {
          return `ID: ${value.id}`;
        }
        return JSON.stringify(value);
      } catch (error) {
        console.error('Error converting object to string:', error);
        return '[Object]';
      }
    }
    return String(value);
  };

  const safeArray = (arr: any): any[] => {
    if (arr == null) return [];
    if (Array.isArray(arr)) return arr;
    return [arr]; // Convert single item to array for consistent handling
  };
  
  const { 
    displays, 
    loading, 
    fetchDisplays,
    pairDisplay, 
    unpairDisplay, 
    restartDisplay,
    updateDisplaySoftware 
  } = useDisplays();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<DisplayWithStatus | null>(null);
  const [isPushContentOpen, setIsPushContentOpen] = useState(false);
  const [pollingStatuses, setPollingStatuses] = useState<Record<string, boolean>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Persistent set to track monitored displays across renders
  const monitoredDisplayIds = useRef<Set<string>>(new Set());

  // Set up monitoring for all displays and track which ones are using polling
  useEffect(() => {
    if (!loading) {
      for (const display of displays) {
        const displayId = safeString(display.id);

        if (!displayId) {
          console.log("SKIP MONITORING: Display has no valid ID", display);
          continue;
        }

        if (isDisplayDeleted(displayId)) {
          console.log(`SKIP MONITORING: Display ${displayId} is marked as deleted in localStorage`);
          continue;
        }
        
        if (hasFailedWith404(displayId)) {
          console.log(`SKIP MONITORING: Display ${displayId} has previously failed with 404`);
          continue;
        }

        if (monitoredDisplayIds.current.has(displayId)) {
          console.log(`SKIP MONITORING: Already monitoring display ${displayId}`);
          continue;
        }

        console.log(`Setting up monitoring for display: ${displayId}`);
        monitoredDisplayIds.current.add(displayId);
        
        // Setup monitoring for this display
        displayPollingService.monitorDisplay(displayId, {
          onUpdate: (updatedDisplay) => {
            console.log(`Display ${updatedDisplay.id} updated via service`);
            // Trigger a refresh of display list to get latest data
            setRefreshTrigger(prev => prev + 1);
          },
          onError: (error) => {
            // Check if this is a not_found error with permanent flag
            const isPermanentNotFound = 
              error && 
              typeof error === 'object' && 
              'type' in error && 
              (error as any).type === 'not_found' &&
              'permanent' in error && 
              (error as any).permanent === true;

            if (isPermanentNotFound) {
              console.log(`Display ${(error as any).displayId} has been permanently removed. Auto-cleaning up.`);
              // Trigger a refresh to remove from UI
              fetchDisplays();
              // Don't show error toast for auto-cleanup
            } else if ((error as any).type === 'max_retries') {
              // Only show retryable errors once
              console.warn(`Display ${(error as any).displayId} temporarily unavailable: ${error.message}`);
              toast.error(error.message, { id: `display-retry-${(error as any).displayId}` });
            } else {
              console.error(`Error monitoring display ${(error as any)?.displayId || safeString(displayId)}:`, error);
              // Only show the first error, not repeated ones
              const errorMsg = error.message || 'Unknown error monitoring display';
              if (!(error as any).is404) { // Don't toast 404 errors
                toast.error(errorMsg, { id: `display-error-${safeString(displayId)}` });
              }
            }
          }
        });
      }

      // Check which displays are using polling fallback
      const checkPollingStatus = () => {
        const newPollingStatuses: Record<string, boolean> = {};
        displays.forEach(display => {
          const displayId = safeString(display.id);
          if (displayId && displayPollingService.isMonitoring(displayId)) {
            newPollingStatuses[displayId] = displayPollingService.isPolling(displayId);
          }
        });
        setPollingStatuses(newPollingStatuses);
      };

      // Check initial status
      checkPollingStatus();

      // Set up interval to check polling status (throttled)
      const pollingCheckInterval = setInterval(checkPollingStatus, 10000); // reduced frequency

      // Cleanup function
      return () => {
        console.log('DisplaysPage polling effect cleanup triggered');
        clearInterval(pollingCheckInterval);
        
        // We don't stop monitoring here because other pages might need the display data
        // The monitoring will be cleaned up by the service itself for 404s
        // Only clean up if we're unmounting completely (not during data refreshes)
      };
    }
  }, [loading, displays.length]); // Only re-run when loading changes or display count changes

  // Refresh displays periodically
  useEffect(() => {
    // Trigger refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchDisplays();
    }, 30000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [fetchDisplays]);

  // Refresh when triggered by polling service updates
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchDisplays();
    }
  }, [refreshTrigger, fetchDisplays]);

  const handleAddDisplay = async (displayData: { pairingCode: string; name: string; location: string }) => {
    try {
      // Validate pairing code format before submitting
      if (!/^[A-Z0-9]{6}$/.test(displayData.pairingCode)) {
        toast.error('Invalid pairing code format. Please enter a 6-character alphanumeric code.');
        return false;
      }
      
      // Show pairing toast
      const pairingToast = toast.loading(`Pairing display "${displayData.name}"...`);
      
      // Attempt to pair the display
      const success = await pairDisplay(
        displayData.pairingCode,
        displayData.name,
        displayData.location
      );
      
      // Dismiss loading toast
      toast.dismiss(pairingToast);
      
      if (success) {
        // Show success toast with more details
        toast.success(`Display "${displayData.name}" paired successfully! You can now push content to it.`);
        return true;
      } else {
        toast.error('Unable to pair display. Please check the pairing code and try again.');
        return false;
      }
    } catch (error) {
      console.error('Error in handleAddDisplay:', error);
      toast.error('An error occurred while pairing the display. Please try again.');
      return false;
    }
  };

  const handleRemoveDisplay = async (displayId: string) => {
    if (!window.confirm('Are you sure you want to remove this display?')) {
      return;
    }
    
    // Stop monitoring the display before removing it
    if (displayPollingService.isMonitoring(displayId)) {
      displayPollingService.stopMonitoring(displayId);
    }
    
    await unpairDisplay(displayId);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePushContent = (display: DisplayWithStatus) => {
    setSelectedDisplay(display);
    setIsPushContentOpen(true);
  };

  const handleClosePushContent = () => {
    setIsPushContentOpen(false);
    setSelectedDisplay(null);
    // Refresh displays to show updated content
    fetchDisplays();
  };

  const handleDisplayAction = async (display: DisplayWithStatus, action: 'restart' | 'update') => {
    try {
      // Show action toast
      const actionToast = toast.loading(`Sending ${action} command to "${safeString(display.name)}"...`);
      
      let success = false;
      if (action === 'restart') {
        success = await restartDisplay(safeString(display.id));
      } else if (action === 'update') {
        success = await updateDisplaySoftware(safeString(display.id));
      }
      
      // Dismiss loading toast
      toast.dismiss(actionToast);
      
      if (success) {
        // Force refresh display data after action command
        const refreshSuccess = await displayPollingService.refreshDisplay(safeString(display.id));
        
        if (refreshSuccess) {
          toast.success(`${action === 'restart' ? 'Restart' : 'Update'} command sent to "${safeString(display.name)}"`);
        } else {
          toast.success(
            `${action === 'restart' ? 'Restart' : 'Update'} command sent to "${safeString(display.name)}", but display status refresh failed`
          );
        }
      } else {
        toast.error(`Failed to ${action} "${safeString(display.name)}". The display may be offline.`);
        
        // Offer retry suggestion
        setTimeout(() => {
          toast.custom((t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Can't reach "{safeString(display.name)}"
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      The display may be offline. Try refreshing its status.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-gray-200">
                <button
                  onClick={() => {
                    handleManualRefresh(safeString(display.id));
                    toast.dismiss(t.id);
                  }}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
                >
                  Refresh
                </button>
              </div>
            </div>
          ), { duration: 5000 });
        }, 1000);
      }
    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      toast.error(`Failed to ${action} display. ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleManualRefresh = async (displayId: string) => {
    try {
      // Show loading toast
      const refreshToast = toast.loading("Refreshing display status...");
      
      // Try to refresh the display
      const success = await displayPollingService.refreshDisplay(displayId);
      
      // Dismiss loading toast
      toast.dismiss(refreshToast);
      
      if (success) {
        toast.success("Display status refreshed");
        
        // Force a direct fetch of all displays to update UI
        fetchDisplays();
      } else {
        toast.error("Unable to refresh display status. The display may be offline.");
      }
    } catch (error) {
      console.error("Error refreshing display:", error);
      toast.error(`Failed to refresh display: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Displays"
        subtitle="Manage your connected display devices"
      >
          <Button
            variant="primary"
            onClick={() => setIsAddDialogOpen(true)}
          >
            Add Display
          </Button>
      </PageHeader>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      ) : displays.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No displays found.</p>
          <p className="text-gray-500 mt-2">
            Click "Add Display" to pair with a new display.
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={() => setIsAddDialogOpen(true)}
            >
              Add Display
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {safeArray(displays).map((display) => (
              <Card key={display?.id || Math.random().toString()}>
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{safeString(display?.name) || 'Unnamed Display'}</h3>
                      <p className="text-gray-500">{safeString(display?.location) || 'No location'}</p>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${getStatusBadgeClass(
                          safeString(display?.status || 'offline')
                        )}`}
                      >
                        {pollingStatuses[safeString(display?.id)] && (
                          <span className="mr-1 flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                          </span>
                        )}
                        {safeString(display?.status) === 'online' ? (
                          <WifiIcon className="h-4 w-4 mr-1 text-green-600" />
                        ) : safeString(display?.status) === 'warning' ? (
                          <ExclamationTriangleIcon className="h-4 w-4 mr-1 text-yellow-600" />
                        ) : (
                          <span className="h-4 w-4 mr-1 inline-block"></span>
                        )}
                        {safeString(display?.status) === 'online' ? 'Online' : safeString(display?.status) === 'warning' ? 'Warning' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">IP Address:</span>
                        <p>{safeString(display?.ipAddress) || 'Not available'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Device ID:</span>
                        <p>{safeString(display?.deviceId) || 'Not available'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Activity:</span>
                        <p>{display?.lastPing ? formatRelativeTime(new Date(display.lastPing)) : 'Never'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Model:</span>
                        <p>{safeString(display?.model) || 'Standard'}</p>
                      </div>
                    </div>
                    
                    {/* Current content section */}
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <PlayCircleIcon className="h-4 w-4 text-indigo-500" />
                        <span className="font-medium">Current Content</span>
                      </div>
                      {display?.activeSchedule ? (
                        <div className="bg-gray-50 rounded p-2 text-sm">
                          <div className="font-medium">{safeString(display.activeSchedule.contentId) || 'Unknown Content'}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Started: {display.activeSchedule.startTime ? formatDate(new Date(display.activeSchedule.startTime)) : 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No active content</p>
                      )}
                    </div>
                    
                    {/* Next scheduled content */}
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <CalendarIcon className="h-4 w-4 text-indigo-500" />
                        <span className="font-medium">Next Scheduled</span>
                      </div>
                      {display?.nextScheduledContent ? (
                        <div className="bg-gray-50 rounded p-2 text-sm">
                          <div className="font-medium">
                            {safeString(display.nextScheduledContent.title) || 'Untitled Content'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Starts: {display.nextScheduledContent.startTime 
                              ? formatDate(new Date(display.nextScheduledContent.startTime)) 
                              : 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No upcoming content</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t">
                        <Button
                          size="sm"
                      variant="outline"
                      disabled={safeString(display?.status) !== 'online'}
                      onClick={() => display && handlePushContent(display)}
                        >
                          Push Content
                        </Button>
                        <Button
                          size="sm"
                      variant="outline"
                      disabled={safeString(display?.status) !== 'online'}
                      onClick={() => display && handleDisplayAction(display, 'restart')}
                        >
                          Restart
                        </Button>
                        <Button
                          size="sm"
                      variant="outline"
                      onClick={() => display?.id && handleManualRefresh(display.id)}
                        >
                      <ArrowPathIcon className="h-4 w-4 mr-1" />
                      Refresh
                        </Button>
                        <Button
                      size="sm"
                          variant="danger"
                      onClick={() => display?.id && handleRemoveDisplay(display.id)}
                        >
                          Remove
                        </Button>
                      </div>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <button 
              onClick={() => window.open('/test-display', '_blank')}
              className="text-blue-600 hover:underline"
            >
              Open TV Device Simulator
            </button>
          </div>
        </div>
      )}
      
      <AddDisplayDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAddDisplay}
      />
      
      {selectedDisplay && (
        <PushContentDialog
          isOpen={isPushContentOpen}
          onClose={handleClosePushContent}
          display={selectedDisplay as any}
        />
      )}
    </div>
  );
};

export default DisplaysPage; 