import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, CalendarIcon, CheckIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { Content } from '@/services/contentService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { aiTools } from '@vizora/common';

interface AISchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (content: Content, scheduleData: { scheduleId: string, schedule: any }) => void;
  content: Content | null;
}

const AISchedulingModal: React.FC<AISchedulingModalProps> = ({
  isOpen,
  onClose,
  onSchedule,
  content
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [dateRange, setDateRange] = useState<{start: Date, end: Date}>({
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default: 1 week from now
  });
  const [insights, setInsights] = useState<string[]>([]);
  const [suggestedFrequency, setSuggestedFrequency] = useState<string | null>(null);
  const [suggestedDuration, setSuggestedDuration] = useState<number | null>(null);

  // Reset and initialize data when content changes
  useEffect(() => {
    if (content) {
      setIsError(false);
      setErrorMessage('');
      setSelectedSlots(new Set());
      
      // Auto-generate recommendations when modal opens
      generateRecommendations();
    }
  }, [content]);

  // Generate schedule recommendations with AI
  const generateRecommendations = async () => {
    if (!content) return;
    
    setIsLoading(true);
    setIsError(false);
    
    try {
      // Call AI scheduling service
      const result = await aiTools.getScheduleRecommendations(
        content.id, 
        dateRange.start, 
        dateRange.end
      );
      
      if (result) {
        setRecommendations(result.recommendations || []);
        setInsights(result.insights || []);
        setSuggestedFrequency(result.suggestedFrequency || null);
        setSuggestedDuration(result.suggestedDuration || null);
        
        // Auto-select the top 3 recommendations
        const newSelectedSlots = new Set<number>();
        result.recommendations.slice(0, 3).forEach((_, index) => {
          newSelectedSlots.add(index);
        });
        setSelectedSlots(newSelectedSlots);
      }
    } catch (error) {
      console.error('Error generating schedule recommendations:', error);
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle selection of a specific time slot
  const toggleSlotSelection = (index: number) => {
    setSelectedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Select all time slots
  const selectAllSlots = () => {
    if (selectedSlots.size === recommendations.length) {
      // If all are selected, deselect all
      setSelectedSlots(new Set());
    } else {
      // Select all
      const allIndices = new Set(recommendations.map((_, index) => index));
      setSelectedSlots(allIndices);
    }
  };

  // Format date and time for display
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date));
  };

  // Format time only for display
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date));
  };

  // Calculate duration between two dates in minutes
  const calculateDuration = (start: Date, end: Date) => {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60));
  };

  // Handle applying the schedule
  const handleSchedule = () => {
    if (!content) return;
    
    const selectedTimeSlots = Array.from(selectedSlots).map(index => recommendations[index]);
    
    onSchedule(content, {
      scheduleId: `schedule-${Date.now()}`,
      schedule: {
        timeSlots: selectedTimeSlots,
        suggestedDuration,
        suggestedFrequency
      }
    });
  };

  // Update date range
  const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
    const newDate = new Date(value);
    setDateRange(prev => ({
      ...prev,
      [type]: newDate
    }));
  };

  // Helper to check if a slot is for today
  const isToday = (date: Date) => {
    const today = new Date();
    return new Date(date).toDateString() === today.toDateString();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-xl bg-white text-left align-middle shadow-xl transition-all">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 flex justify-between items-center">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-white flex items-center">
                    <CalendarIcon className="h-5 w-5 mr-2" />
                    AI Smart Scheduling
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-full p-1 hover:bg-white hover:bg-opacity-20"
                  >
                    <XMarkIcon className="h-5 w-5 text-white" />
                  </button>
                </div>

                <div className="px-6 py-4">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Spinner size="lg" />
                      <p className="mt-4 text-gray-600">Generating optimal schedule recommendations...</p>
                    </div>
                  ) : isError ? (
                    <div className="py-12 text-center">
                      <div className="text-red-500 mb-4">
                        {errorMessage || 'Something went wrong. Please try again.'}
                      </div>
                      <Button onClick={generateRecommendations}>Retry</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-6">
                      {/* Schedule recommendations */}
                      <div className="col-span-2">
                        <div className="mb-4 flex justify-between items-center">
                          <h4 className="text-sm font-medium">Recommended Time Slots</h4>
                          
                          <div className="flex items-center">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs"
                              onClick={selectAllSlots}
                            >
                              {selectedSlots.size === recommendations.length ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Date range selector */}
                        <div className="mb-4 grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                            <input 
                              type="date"
                              value={dateRange.start.toISOString().slice(0, 10)}
                              onChange={(e) => handleDateRangeChange('start', e.target.value)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                            <input 
                              type="date"
                              value={dateRange.end.toISOString().slice(0, 10)}
                              onChange={(e) => handleDateRangeChange('end', e.target.value)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="mb-2 flex justify-between">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-xs"
                            onClick={generateRecommendations}
                          >
                            Refresh Recommendations
                          </Button>
                          
                          <span className="text-xs text-gray-500">
                            {selectedSlots.size} of {recommendations.length} slots selected
                          </span>
                        </div>
                        
                        {/* Recommendations list */}
                        <div className="border border-gray-200 rounded-md overflow-hidden">
                          <div className="max-h-96 overflow-y-auto">
                            {recommendations.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                No recommendations available. Adjust date range and try again.
                              </div>
                            ) : (
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                  <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Select
                                    </th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Date & Time
                                    </th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Duration
                                    </th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Confidence
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {recommendations.map((recommendation, index) => (
                                    <tr 
                                      key={index}
                                      className={`${selectedSlots.has(index) ? 'bg-blue-50' : ''} 
                                        ${isToday(recommendation.startTime) ? 'bg-yellow-50' : ''} 
                                        hover:bg-gray-50`}
                                    >
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        <input
                                          type="checkbox"
                                          checked={selectedSlots.has(index)}
                                          onChange={() => toggleSlotSelection(index)}
                                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                          {formatDateTime(recommendation.startTime)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          to {formatTime(recommendation.endTime)}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        <span className="text-sm text-gray-900">
                                          {calculateDuration(recommendation.startTime, recommendation.endTime)} mins
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                            <div 
                                              className="bg-blue-600 h-2 rounded-full" 
                                              style={{ width: `${Math.round(recommendation.confidence * 100)}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-sm text-gray-900">
                                            {Math.round(recommendation.confidence * 100)}%
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Insights panel */}
                      <div className="col-span-1">
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-4">Scheduling Insights</h4>
                          
                          {content && (
                            <div className="mb-4">
                              <p className="text-xs font-medium text-gray-600">Content: {content.title}</p>
                              <p className="text-xs text-gray-500">{content.type} • {new Date(content.createdAt).toLocaleDateString()}</p>
                            </div>
                          )}
                          
                          {suggestedFrequency && (
                            <div className="mb-3">
                              <h5 className="text-xs font-medium text-gray-600">Suggested Frequency</h5>
                              <p className="text-sm text-blue-600">{suggestedFrequency}</p>
                            </div>
                          )}
                          
                          {suggestedDuration !== null && (
                            <div className="mb-3">
                              <h5 className="text-xs font-medium text-gray-600">Optimal Display Duration</h5>
                              <p className="text-sm text-blue-600">{suggestedDuration} minutes</p>
                            </div>
                          )}
                          
                          <h5 className="text-xs font-medium text-gray-600 mb-2">AI Insights</h5>
                          <ul className="space-y-2 mb-4">
                            {insights.length > 0 ? insights.map((insight, index) => (
                              <li key={index} className="text-xs text-gray-600 flex items-start">
                                <CheckIcon className="h-3 w-3 text-green-500 mr-1 mt-0.5 flex-shrink-0" />
                                <span>{insight}</span>
                              </li>
                            )) : (
                              <li className="text-xs text-gray-500 italic">No insights available</li>
                            )}
                          </ul>
                          
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {}} // This would open a custom scheduling form
                              className="w-full text-xs flex items-center justify-center"
                            >
                              <PlusCircleIcon className="h-3 w-3 mr-1" />
                              Add Custom Time Slot
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSchedule} 
                    disabled={isLoading || selectedSlots.size === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Schedule {selectedSlots.size} Time Slots
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AISchedulingModal; 