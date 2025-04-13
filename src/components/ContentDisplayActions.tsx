import React, { useState, useEffect } from 'react';
import { Display, ContentSchedule, ContentPush } from '../types/display';
import displayService from '../services/displayService';
import { ClockIcon, PlayIcon } from '@heroicons/react/24/outline';

interface ContentDisplayActionsProps {
  contentId: string;
  onComplete?: () => void;
}

const ContentDisplayActions: React.FC<ContentDisplayActionsProps> = ({
  contentId,
  onComplete
}) => {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedule, setSchedule] = useState<Partial<ContentSchedule>>({
    startTime: '',
    endTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    repeat: 'none'
  });
  const [conflicts, setConflicts] = useState<ContentSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDisplays();
  }, []);

  useEffect(() => {
    if (schedule.startTime && schedule.endTime && selectedDisplays.length > 0) {
      checkConflicts();
    }
  }, [schedule.startTime, schedule.endTime, selectedDisplays]);

  const loadDisplays = async () => {
    try {
      const displaysData = await displayService.getDisplays();
      setDisplays(displaysData);
    } catch (err) {
      setError('Failed to load displays');
    }
  };

  const checkConflicts = async () => {
    try {
      const conflictsData = await Promise.all(
        selectedDisplays.map(displayId =>
          displayService.checkScheduleConflicts(
            displayId,
            schedule.startTime!,
            schedule.endTime!
          )
        )
      );
      setConflicts(conflictsData.flat());
    } catch (err) {
      setError('Failed to check schedule conflicts');
    }
  };

  const handleDisplayToggle = (displayId: string) => {
    setSelectedDisplays(prev =>
      prev.includes(displayId)
        ? prev.filter(id => id !== displayId)
        : [...prev, displayId]
    );
  };

  const handleScheduleSubmit = async () => {
    if (selectedDisplays.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      await displayService.scheduleContentForDisplays(contentId, selectedDisplays, schedule as Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'displayId'>);
      onComplete?.();
    } catch (err) {
      setError('Failed to schedule content');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushSubmit = async () => {
    if (selectedDisplays.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      await displayService.pushContentToDisplays(contentId, selectedDisplays);
      onComplete?.();
    } catch (err) {
      setError('Failed to push content');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushContent = async () => {
    setError(null);
    try {
      await displayService.pushContentToDisplays(contentId, selectedDisplays);
      onComplete();
    } catch (err) {
      setError('Failed to push content');
    }
  };

  const handleScheduleContent = async () => {
    setError(null);
    try {
      await displayService.scheduleContentForDisplays(contentId, selectedDisplays, schedule as Omit<ContentSchedule, 'id' | 'createdAt' | 'updatedAt' | 'owner' | 'displayId'>);
      onComplete();
    } catch (err) {
      setError('Failed to schedule content');
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Push or Schedule Content
        </h3>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Display Selection */}
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
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  display.status === 'online'
                    ? 'bg-green-500'
                    : display.status === 'offline'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Action Type Selection */}
      <div className="mb-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setIsScheduling(false)}
            className={`flex items-center px-4 py-2 rounded-md ${
              !isScheduling
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}
            data-testid="push-button"
          >
            <PlayIcon className="h-5 w-5 mr-2" />
            Push Now
          </button>
          <button
            onClick={() => setIsScheduling(true)}
            className={`flex items-center px-4 py-2 rounded-md ${
              isScheduling
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}
            data-testid="schedule-button"
          >
            <ClockIcon className="h-5 w-5 mr-2" />
            Schedule
          </button>
        </div>
      </div>

      {/* Schedule Form */}
      {isScheduling && (
        <div className="space-y-4">
          <div>
            <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="datetime-local"
              id="start-time"
              value={schedule.startTime}
              onChange={e => setSchedule(prev => ({ ...prev, startTime: e.target.value }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            />
          </div>
          <div>
            <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              type="datetime-local"
              id="end-time"
              value={schedule.endTime}
              onChange={e => setSchedule(prev => ({ ...prev, endTime: e.target.value }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            />
          </div>
          <div>
            <label htmlFor="repeat" className="block text-sm font-medium text-gray-700 mb-1">
              Repeat
            </label>
            <select
              id="repeat"
              value={schedule.repeat}
              onChange={e => setSchedule(prev => ({ ...prev, repeat: e.target.value }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              data-testid="repeat-select"
            >
              <option value="none">No Repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              id="timezone"
              value={schedule.timezone}
              onChange={e => setSchedule(prev => ({ ...prev, timezone: e.target.value }))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              data-testid="timezone-select"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
          {conflicts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                Schedule Conflicts
              </h4>
              <ul className="text-sm text-yellow-700">
                {conflicts.map((conflict, index) => {
                  if (!conflict) return null;
                  const displayId = conflict.displayId || conflict.display?.id;
                  const display = displayId ? displays.find(d => d.id === displayId) : null;
                  const startTime = conflict.startTime || 'Unknown';
                  const endTime = conflict.endTime || 'Unknown';
                  return (
                    <li key={index}>
                      {display?.name || 'Unknown Display'}: {startTime} - {endTime}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end space-x-3">
        <button
          onClick={() => onComplete?.()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          onClick={isScheduling ? handleScheduleSubmit : handlePushSubmit}
          disabled={isLoading || selectedDisplays.length === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={isScheduling ? 'schedule-submit-button' : 'push-submit-button'}
        >
          {isLoading ? 'Processing...' : isScheduling ? 'Schedule Content' : 'Push Content'}
        </button>
      </div>
    </div>
  );
};

export default ContentDisplayActions; 