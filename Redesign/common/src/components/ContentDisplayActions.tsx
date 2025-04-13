import React, { useState } from 'react';

interface Display {
  id: string;
  name: string;
  status: 'online' | 'offline';
}

interface ContentDisplayActionsProps {
  displays: Display[];
  onPush: (displayIds: string[]) => void;
  onSchedule: (displayIds: string[], schedule: {
    startTime: string;
    endTime: string;
    timezone: string;
    repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  }) => void;
  onCancel: () => void;
}

export const ContentDisplayActions: React.FC<ContentDisplayActionsProps> = ({
  displays,
  onPush,
  onSchedule,
  onCancel,
}) => {
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([]);
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [schedule, setSchedule] = useState({
    startTime: '',
    endTime: '',
    timezone: 'UTC',
    repeat: 'none' as const,
  });

  const handleDisplayToggle = (displayId: string) => {
    setSelectedDisplays(prev =>
      prev.includes(displayId)
        ? prev.filter(id => id !== displayId)
        : [...prev, displayId]
    );
  };

  const handlePush = () => {
    onPush(selectedDisplays);
  };

  const handleSchedule = () => {
    onSchedule(selectedDisplays, schedule);
  };

  const isPushDisabled = selectedDisplays.length === 0;

  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Push or Schedule Content
        </h3>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Displays
        </label>
        <div className="grid grid-cols-2 gap-2">
          {displays.map(display => (
            <label
              key={display.id}
              className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedDisplays.includes(display.id)}
                onChange={() => handleDisplayToggle(display.id)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">{display.name}</span>
              <span className="text-sm text-gray-500">
                {display.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setIsScheduleMode(false)}
            className={`flex items-center px-4 py-2 rounded-md ${
              isScheduleMode
                ? 'bg-gray-100 text-gray-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
              />
            </svg>
            Push Now
          </button>
          <button
            onClick={() => setIsScheduleMode(true)}
            className={`flex items-center px-4 py-2 rounded-md ${
              isScheduleMode
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Schedule
          </button>
        </div>
      </div>
      {isScheduleMode && (
        <div className="space-y-4">
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              id="startTime"
              type="datetime-local"
              value={schedule.startTime}
              onChange={(e) => setSchedule(prev => ({ ...prev, startTime: e.target.value }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            />
          </div>
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              id="endTime"
              type="datetime-local"
              value={schedule.endTime}
              onChange={(e) => setSchedule(prev => ({ ...prev, endTime: e.target.value }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            />
          </div>
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              id="timezone"
              value={schedule.timezone}
              onChange={(e) => setSchedule(prev => ({ ...prev, timezone: e.target.value }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
          <div>
            <label htmlFor="repeat" className="block text-sm font-medium text-gray-700 mb-1">
              Repeat
            </label>
            <select
              id="repeat"
              value={schedule.repeat}
              onChange={(e) => setSchedule(prev => ({ ...prev, repeat: e.target.value as typeof schedule.repeat }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="none">No Repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          onClick={isScheduleMode ? handleSchedule : handlePush}
          disabled={isPushDisabled}
          className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            isPushDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isScheduleMode ? 'Schedule Content' : 'Push Content'}
        </button>
      </div>
    </div>
  );
}; 