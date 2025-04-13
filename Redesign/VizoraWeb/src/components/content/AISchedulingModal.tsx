import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { Content } from '@vizora/common';

interface AISchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (content: Content, scheduleData: { scheduleId: string; schedule: any }) => void;
  content: Content | null;
  isProcessing: boolean;
}

export const AISchedulingModal: React.FC<AISchedulingModalProps> = ({
  isOpen,
  onClose,
  onApply,
  content,
  isProcessing
}) => {
  const [selectedSchedule, setSelectedSchedule] = useState<string>('optimal');
  const [schedulePreview, setSchedulePreview] = useState<any>(null);

  if (!content) return null;

  const handleApply = () => {
    if (schedulePreview) {
      onApply(content, {
        scheduleId: selectedSchedule,
        schedule: schedulePreview
      });
    }
  };

  return (
    <Modal
      title="AI Content Scheduling"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-start">
            <CalendarIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-900">AI-Optimized Schedule</h3>
              <p className="mt-1 text-sm text-blue-700">
                Our AI will analyze your audience engagement patterns and suggest optimal posting times.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Content preview */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Content to Schedule</h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><span className="font-medium">Title:</span> {content.title}</p>
              <p className="text-sm text-gray-600"><span className="font-medium">Type:</span> {content.type}</p>
            </div>
          </div>

          {/* Schedule options */}
          <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-cyan-50">
            <h4 className="text-sm font-medium text-gray-700 mb-4">Suggested Schedules</h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  value="optimal"
                  checked={selectedSchedule === 'optimal'}
                  onChange={(e) => setSelectedSchedule(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Optimal Engagement Times</p>
                  <p className="text-xs text-gray-500">Schedule based on highest historical engagement</p>
                </div>
              </label>
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  value="balanced"
                  checked={selectedSchedule === 'balanced'}
                  onChange={(e) => setSelectedSchedule(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Balanced Distribution</p>
                  <p className="text-xs text-gray-500">Evenly spread across peak hours</p>
                </div>
              </label>
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  value="custom"
                  checked={selectedSchedule === 'custom'}
                  onChange={(e) => setSelectedSchedule(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Custom AI Schedule</p>
                  <p className="text-xs text-gray-500">Tailored to your specific goals</p>
                </div>
              </label>
            </div>
          </div>

          {/* Schedule preview */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Schedule Preview</h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                {isProcessing ? (
                  <span className="flex items-center">
                    <Spinner size="sm" className="mr-2" />
                    Generating optimal schedule...
                  </span>
                ) : (
                  "Schedule details will appear here"
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={isProcessing || !schedulePreview}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Applying Schedule...
              </>
            ) : (
              <>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Apply Schedule
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}; 