import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition, RadioGroup } from '@headlessui/react';
import { XMarkIcon, ClockIcon, CalendarIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ContentItem } from './ContentPage';

interface Display {
  id: string;
  name: string;
  location?: string;
  status: 'active' | 'inactive' | 'offline';
  lastActive?: string;
}

interface ScheduleOptions {
  type: 'now' | 'later' | 'recurring';
  startDate?: Date;
  endDate?: Date;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  duration?: number; // in minutes
}

interface ContentSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContent: ContentItem[];
  availableDisplays: Display[];
  onSchedule: (displays: Display[], schedule: ScheduleOptions) => Promise<void>;
}

const ContentSchedulingModal: React.FC<ContentSchedulingModalProps> = ({
  isOpen,
  onClose,
  selectedContent,
  availableDisplays,
  onSchedule
}) => {
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<'now' | 'later' | 'recurring'>('now');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [duration, setDuration] = useState<number>(30);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    // Set default dates and times
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    
    setStartDate(formatDateForInput(now));
    setEndDate(formatDateForInput(tomorrow));
    
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;
    
    setStartTime(`${currentHour.toString().padStart(2, '0')}:00`);
    setEndTime(`${nextHour.toString().padStart(2, '0')}:00`);
  }, []);
  
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const handleDayToggle = (day: string) => {
    setDaysOfWeek(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const selectedDisplayObjects = availableDisplays.filter(
        display => selectedDisplays.includes(display.id)
      );
      
      const scheduleOptions: ScheduleOptions = {
        type: scheduleType
      };
      
      if (scheduleType === 'later' || scheduleType === 'recurring') {
        scheduleOptions.startDate = startDate ? new Date(startDate) : undefined;
        scheduleOptions.startTime = startTime;
      }
      
      if (scheduleType === 'recurring') {
        scheduleOptions.endDate = endDate ? new Date(endDate) : undefined;
        scheduleOptions.endTime = endTime;
        scheduleOptions.daysOfWeek = daysOfWeek;
        scheduleOptions.duration = duration;
      }
      
      await onSchedule(selectedDisplayObjects, scheduleOptions);
      onClose();
    } catch (error) {
      console.error('Error scheduling content:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getContentPreviewText = () => {
    if (selectedContent.length === 0) return 'No content selected';
    if (selectedContent.length === 1) return `"${selectedContent[0].title}"`;
    return `${selectedContent.length} items selected`;
  };
  
  const getScheduleDescription = () => {
    switch (scheduleType) {
      case 'now':
        return 'Content will be displayed immediately on the selected displays.';
      case 'later':
        return `Content will be scheduled for ${startDate} at ${startTime}.`;
      case 'recurring':
        return `Content will be scheduled from ${startDate} to ${endDate}, on selected days, for ${duration} minutes each day.`;
      default:
        return '';
    }
  };
  
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                
                <div>
                  <div className="text-center sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Schedule Content
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Schedule {getContentPreviewText()} on your displays.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6 space-y-6">
                    {/* Display selection */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Select displays</h4>
                      <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                        {availableDisplays.map((display) => (
                          <div key={display.id} className="flex items-center py-2">
                            <input
                              id={`display-${display.id}`}
                              name={`display-${display.id}`}
                              type="checkbox"
                              checked={selectedDisplays.includes(display.id)}
                              onChange={() => {
                                if (selectedDisplays.includes(display.id)) {
                                  setSelectedDisplays(prev => prev.filter(id => id !== display.id));
                                } else {
                                  setSelectedDisplays(prev => [...prev, display.id]);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor={`display-${display.id}`} className="ml-3">
                              <span className="block text-sm font-medium text-gray-700">
                                {display.name}
                              </span>
                              {display.location && (
                                <span className="block text-xs text-gray-500">
                                  {display.location}
                                </span>
                              )}
                            </label>
                            <span 
                              className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                display.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : display.status === 'inactive'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {display.status}
                            </span>
                          </div>
                        ))}
                        
                        {availableDisplays.length === 0 && (
                          <p className="py-3 text-sm text-gray-500 text-center">
                            No displays available
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Schedule type */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">When to display</h4>
                      <RadioGroup value={scheduleType} onChange={setScheduleType} className="mt-2">
                        <RadioGroup.Label className="sr-only">Schedule type</RadioGroup.Label>
                        <div className="space-y-2">
                          <RadioGroup.Option
                            value="now"
                            className={({ checked }) =>
                              `${
                                checked ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                              } relative flex cursor-pointer rounded-lg border p-4 focus:outline-none`
                            }
                          >
                            {({ checked }) => (
                              <>
                                <div className="flex w-full items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="text-sm">
                                      <RadioGroup.Label
                                        as="p"
                                        className="font-medium text-gray-900"
                                      >
                                        Display Now
                                      </RadioGroup.Label>
                                      <RadioGroup.Description
                                        as="p"
                                        className="text-gray-500"
                                      >
                                        Immediately display content on selected screens
                                      </RadioGroup.Description>
                                    </div>
                                  </div>
                                  {checked && (
                                    <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                                  )}
                                </div>
                              </>
                            )}
                          </RadioGroup.Option>
                          
                          <RadioGroup.Option
                            value="later"
                            className={({ checked }) =>
                              `${
                                checked ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                              } relative flex cursor-pointer rounded-lg border p-4 focus:outline-none`
                            }
                          >
                            {({ checked }) => (
                              <>
                                <div className="flex w-full items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="text-sm">
                                      <RadioGroup.Label
                                        as="p"
                                        className="font-medium text-gray-900"
                                      >
                                        Schedule for Later
                                      </RadioGroup.Label>
                                      <RadioGroup.Description
                                        as="p"
                                        className="text-gray-500"
                                      >
                                        Schedule content for a specific date and time
                                      </RadioGroup.Description>
                                    </div>
                                  </div>
                                  {checked && (
                                    <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                                  )}
                                </div>
                                
                                {checked && (
                                  <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div>
                                      <label htmlFor="start-date" className="block text-xs font-medium text-gray-700">
                                        Date
                                      </label>
                                      <input
                                        type="date"
                                        id="start-date"
                                        name="start-date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label htmlFor="start-time" className="block text-xs font-medium text-gray-700">
                                        Time
                                      </label>
                                      <input
                                        type="time"
                                        id="start-time"
                                        name="start-time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      />
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </RadioGroup.Option>
                          
                          <RadioGroup.Option
                            value="recurring"
                            className={({ checked }) =>
                              `${
                                checked ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                              } relative flex cursor-pointer rounded-lg border p-4 focus:outline-none`
                            }
                          >
                            {({ checked }) => (
                              <>
                                <div className="flex w-full items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="text-sm">
                                      <RadioGroup.Label
                                        as="p"
                                        className="font-medium text-gray-900"
                                      >
                                        Recurring Schedule
                                      </RadioGroup.Label>
                                      <RadioGroup.Description
                                        as="p"
                                        className="text-gray-500"
                                      >
                                        Schedule content to display on recurring days and times
                                      </RadioGroup.Description>
                                    </div>
                                  </div>
                                  {checked && (
                                    <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                                  )}
                                </div>
                                
                                {checked && (
                                  <div className="mt-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label htmlFor="recurring-start-date" className="block text-xs font-medium text-gray-700">
                                          Start Date
                                        </label>
                                        <input
                                          type="date"
                                          id="recurring-start-date"
                                          name="recurring-start-date"
                                          value={startDate}
                                          onChange={(e) => setStartDate(e.target.value)}
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label htmlFor="recurring-end-date" className="block text-xs font-medium text-gray-700">
                                          End Date
                                        </label>
                                        <input
                                          type="date"
                                          id="recurring-end-date"
                                          name="recurring-end-date"
                                          value={endDate}
                                          onChange={(e) => setEndDate(e.target.value)}
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label htmlFor="recurring-start-time" className="block text-xs font-medium text-gray-700">
                                          Start Time
                                        </label>
                                        <input
                                          type="time"
                                          id="recurring-start-time"
                                          name="recurring-start-time"
                                          value={startTime}
                                          onChange={(e) => setStartTime(e.target.value)}
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label htmlFor="duration" className="block text-xs font-medium text-gray-700">
                                          Duration (minutes)
                                        </label>
                                        <input
                                          type="number"
                                          id="duration"
                                          name="duration"
                                          min="5"
                                          max="1440"
                                          value={duration}
                                          onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <span className="block text-xs font-medium text-gray-700">
                                        Days of Week
                                      </span>
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => handleDayToggle(day)}
                                            className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium ${
                                              daysOfWeek.includes(day)
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-gray-100 text-gray-800'
                                            }`}
                                          >
                                            {day.slice(0, 3)}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </RadioGroup.Option>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    {/* Schedule summary */}
                    <div className="rounded-md bg-blue-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ClockIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">Schedule Summary</h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>
                              {getScheduleDescription()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || selectedDisplays.length === 0}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                        Scheduling...
                      </>
                    ) : 'Schedule Content'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default ContentSchedulingModal; 