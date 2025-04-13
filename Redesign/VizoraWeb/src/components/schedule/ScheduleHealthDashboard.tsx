import React from 'react';
import { Schedule, cleanupSchedules, findOverlappingSchedules } from '@vizora/common';
import { 
  AlertTriangleIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  BarChartIcon,
  CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScheduleHealthDashboardProps {
  schedules: Schedule[];
  className?: string;
}

export function ScheduleHealthDashboard({
  schedules,
  className
}: ScheduleHealthDashboardProps) {
  // Get schedule health metrics
  const { activeSchedules, expiredSchedules, recommendations } = cleanupSchedules(schedules, {
    includeRecommendations: true
  });
  
  const overlappingSchedules = findOverlappingSchedules(activeSchedules);
  const inactiveSchedules = schedules.filter(s => !s.active);
  
  // Placeholder for execution logs (to be implemented)
  const executionLogs = [
    { id: 1, type: 'success', message: 'Schedule "Morning News" executed successfully', timestamp: new Date() },
    { id: 2, type: 'error', message: 'Failed to execute schedule "Evening Show"', timestamp: new Date() },
    { id: 3, type: 'warning', message: 'Schedule "Weekly Update" has overlapping conflicts', timestamp: new Date() }
  ];
  
  // Placeholder for upcoming alerts (to be implemented)
  const upcomingAlerts = [
    { id: 1, type: 'conflict', message: 'Schedule conflict detected in 2 hours', scheduleId: 'schedule-1' },
    { id: 2, type: 'expiration', message: '3 schedules will expire in 24 hours', scheduleIds: ['schedule-2', 'schedule-3', 'schedule-4'] }
  ];
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Health Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Active Schedules</h3>
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-semibold mt-2">{activeSchedules.length}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Schedule Conflicts</h3>
            <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-2xl font-semibold mt-2">{overlappingSchedules.length}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Inactive Schedules</h3>
            <XCircleIcon className="h-5 w-5 text-gray-500" />
          </div>
          <p className="text-2xl font-semibold mt-2">{inactiveSchedules.length}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Expired Schedules</h3>
            <ClockIcon className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-semibold mt-2">{expiredSchedules.length}</p>
        </div>
      </div>
      
      {/* Schedule Timeline */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Schedule Timeline</h3>
        <div className="h-64 bg-gray-50 rounded">
          {/* Placeholder for timeline visualization */}
          <div className="flex items-center justify-center h-full text-gray-400">
            <CalendarIcon className="h-8 w-8 mr-2" />
            <span>Schedule Timeline Visualization</span>
          </div>
        </div>
      </div>
      
      {/* Execution Logs */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Recent Execution Logs</h3>
        <div className="space-y-2">
          {executionLogs.map(log => (
            <div
              key={log.id}
              className={cn(
                "flex items-center p-2 rounded",
                log.type === 'error' ? 'bg-red-50 text-red-700' :
                log.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                'bg-green-50 text-green-700'
              )}
            >
              {log.type === 'error' ? <XCircleIcon className="h-4 w-4 mr-2" /> :
               log.type === 'warning' ? <AlertTriangleIcon className="h-4 w-4 mr-2" /> :
               <CheckCircleIcon className="h-4 w-4 mr-2" />}
              <span className="text-sm">{log.message}</span>
              <span className="text-xs ml-auto">
                {log.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Upcoming Alerts */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Upcoming Alerts</h3>
        <div className="space-y-2">
          {upcomingAlerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                "flex items-center p-2 rounded",
                alert.type === 'conflict' ? 'bg-amber-50 text-amber-700' :
                'bg-blue-50 text-blue-700'
              )}
            >
              <AlertTriangleIcon className="h-4 w-4 mr-2" />
              <span className="text-sm">{alert.message}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-medium mb-4">Schedule Recommendations</h3>
          <div className="space-y-2">
            {recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="flex items-center p-2 rounded bg-blue-50 text-blue-700"
              >
                <BarChartIcon className="h-4 w-4 mr-2" />
                <span className="text-sm">{recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 