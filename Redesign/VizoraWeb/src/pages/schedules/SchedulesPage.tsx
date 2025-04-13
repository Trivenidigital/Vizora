import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { 
  CalendarIcon, 
  ChartBarIcon, 
  FunnelIcon, 
  PlusIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import { useSchedules, Schedule, ScheduleFilters } from '@/hooks/useSchedules';
import { ScheduleDisplay } from '@/components/schedule';
import { useConnectionState } from '@vizora/common/hooks/useConnectionStatus';

const SchedulesPage: React.FC = () => {
  const { 
    schedules, 
    activeSchedules, 
    upcomingSchedules,
    loading, 
    error, 
    stats,
    statsLoading,
    filters,
    fetchSchedules,
    updateFilters,
    clearFilters,
    pauseSchedule,
    resumeSchedule,
    cancelSchedule,
    deleteSchedule
  } = useSchedules();
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { isConnected } = useConnectionState();

  // Handle refresh
  const handleRefresh = () => {
    fetchSchedules(true);
    toast.success('Refreshing schedules...');
  };
  
  // Handle pause
  const handlePause = async (id: string) => {
    try {
      const result = await pauseSchedule(id);
      if (result) {
        toast.success('Schedule paused successfully');
      } else {
        toast.error('Failed to pause schedule');
      }
    } catch (error) {
      toast.error('An error occurred while pausing the schedule');
    }
  };
  
  // Handle resume
  const handleResume = async (id: string) => {
    try {
      const result = await resumeSchedule(id);
      if (result) {
        toast.success('Schedule resumed successfully');
      } else {
        toast.error('Failed to resume schedule');
      }
    } catch (error) {
      toast.error('An error occurred while resuming the schedule');
    }
  };
  
  // Handle cancel
  const handleCancel = async (id: string) => {
    try {
      const result = await cancelSchedule(id);
      if (result) {
        toast.success('Schedule cancelled successfully');
      } else {
        toast.error('Failed to cancel schedule');
      }
    } catch (error) {
      toast.error('An error occurred while cancelling the schedule');
    }
  };
  
  // Handle delete
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        const result = await deleteSchedule(id);
        if (result) {
          toast.success('Schedule deleted successfully');
        } else {
          toast.error('Failed to delete schedule');
        }
      } catch (error) {
        toast.error('An error occurred while deleting the schedule');
      }
    }
  };
  
  // Handle view details
  const handleViewDetails = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setIsDetailsOpen(true);
  };
  
  // Show filter panel
  const toggleFilterPanel = () => {
    setIsFilterOpen(!isFilterOpen);
  };
  
  // Apply filters
  const applyFilters = (newFilters: ScheduleFilters) => {
    updateFilters(newFilters);
    setIsFilterOpen(false);
  };

  // Render schedules in a grid layout
  const renderScheduleGrid = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="bg-white rounded-lg shadow overflow-hidden">
            <ScheduleDisplay 
              schedule={schedule}
              onPause={() => handlePause(schedule.id)}
              onResume={() => handleResume(schedule.id)}
              onCancel={() => handleCancel(schedule.id)}
              onDelete={() => handleDelete(schedule.id)}
              onViewDetails={() => handleViewDetails(schedule)}
            />
          </div>
        ))}
      </div>
    );
  };

  // Render loading state
  const renderLoading = () => {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="flex flex-col items-center">
          <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="mt-2 text-sm text-gray-500">Loading schedules...</span>
        </div>
      </div>
    );
  };

  // Render error state
  const renderError = () => {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              {error || 'An error occurred while loading schedules.'}
            </p>
            <button
              onClick={handleRefresh}
              className="mt-2 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h2 className="mt-2 text-lg font-medium text-gray-900">No schedules found</h2>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new schedule for your displays.
        </p>
        <div className="mt-6">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            New Schedule
          </button>
        </div>
      </div>
    );
  };

  // Stats card component
  const StatsCard = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">{icon}</div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">{value}</div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  const getConnectionStatusMessage = () => {
    if (!isConnected) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You are currently offline. Schedule information may not be up to date.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Content Schedules
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Schedule content for your displays and manage active schedules.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
          <button
            type="button"
            onClick={toggleFilterPanel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FunnelIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" aria-hidden="true" />
            Filter
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            New Schedule
          </button>
        </div>
      </div>

      {/* Connection status message */}
      {getConnectionStatusMessage()}
      
      {/* Stats row */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatsCard 
            title="Total Schedules" 
            value={stats.total} 
            icon={<CalendarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />} 
          />
          <StatsCard 
            title="Active" 
            value={stats.active} 
            icon={<CalendarIcon className="h-6 w-6 text-green-400" aria-hidden="true" />} 
          />
          <StatsCard 
            title="Upcoming" 
            value={upcomingSchedules.length} 
            icon={<CalendarIcon className="h-6 w-6 text-blue-400" aria-hidden="true" />} 
          />
          <StatsCard 
            title="Paused" 
            value={stats.paused} 
            icon={<CalendarIcon className="h-6 w-6 text-yellow-400" aria-hidden="true" />} 
          />
        </div>
      )}

      {/* Filter tags */}
      {Object.keys(filters).length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">Filters:</span>
          {Object.entries(filters).map(([key, value]) => (
            value && (
              <span key={key} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-indigo-100 text-indigo-800">
                {key}: {value.toString()}
                <button
                  type="button"
                  className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-indigo-400 hover:text-indigo-600 focus:outline-none"
                  onClick={() => updateFilters({ [key]: undefined })}
                >
                  <span className="sr-only">Remove filter for {key}</span>
                  <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            )
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main content */}
      <div>
        {loading ? (
          renderLoading()
        ) : error ? (
          renderError()
        ) : schedules.length === 0 ? (
          renderEmpty()
        ) : (
          renderScheduleGrid()
        )}
      </div>
      
      {/* TODO: Filter panel */}
      {/* TODO: Schedule detail modal */}
      {/* TODO: Create/Edit schedule modal */}
    </div>
  );
};

export default SchedulesPage; 