import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { Content } from '@vizora/common';

interface AIAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content | null;
  isLoading: boolean;
}

export const AIAnalyticsModal: React.FC<AIAnalyticsModalProps> = ({
  isOpen,
  onClose,
  content,
  isLoading
}) => {
  if (!content) return null;

  return (
    <Modal
      title="AI Content Analytics"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6">
        <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-100">
          <div className="flex items-start">
            <ChartBarIcon className="h-5 w-5 text-cyan-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-cyan-900">AI-Powered Analytics</h3>
              <p className="mt-1 text-sm text-cyan-700">
                Get detailed insights and performance analysis for your content.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Content info */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Content Information</h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><span className="font-medium">Title:</span> {content.title}</p>
              <p className="text-sm text-gray-600"><span className="font-medium">Type:</span> {content.type}</p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Created:</span> {new Date(content.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Analytics sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Engagement metrics */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Engagement Metrics</h4>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Views</span>
                    <span className="text-sm font-medium">1,234</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average View Time</span>
                    <span className="text-sm font-medium">2:45</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Interaction Rate</span>
                    <span className="text-sm font-medium">4.2%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Performance insights */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Performance Insights</h4>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded-md">
                    <p className="text-sm text-green-700">
                      Content performs 23% better than average in your library
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-700">
                      Peak engagement times: 9AM-11AM, 2PM-4PM
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-md">
                    <p className="text-sm text-purple-700">
                      Most engaged audience segment: Marketing professionals
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="border rounded-lg p-4 md:col-span-2">
              <h4 className="text-sm font-medium text-gray-700 mb-3">AI Recommendations</h4>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center justify-center text-white text-sm">
                      1
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Optimize Posting Schedule</p>
                      <p className="text-sm text-gray-600">
                        Schedule future posts during peak engagement hours (9AM-11AM) for maximum reach.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center justify-center text-white text-sm">
                      2
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Content Enhancement</p>
                      <p className="text-sm text-gray-600">
                        Add more interactive elements to increase engagement time.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center justify-center text-white text-sm">
                      3
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Audience Targeting</p>
                      <p className="text-sm text-gray-600">
                        Focus distribution on marketing professional networks for better engagement.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
          <Button
            onClick={onClose}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}; 