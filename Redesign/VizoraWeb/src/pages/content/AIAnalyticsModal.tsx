import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, ChartBarIcon, CheckIcon, ArrowUpIcon, ArrowDownIcon, MinusIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import { Content } from '@/services/contentService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { aiTools } from '@vizora/common';

interface AIAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content | null;
}

const AIAnalyticsModal: React.FC<AIAnalyticsModalProps> = ({
  isOpen,
  onClose,
  content
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [insights, setInsights] = useState<string[]>([]);
  const [predictions, setPredictons] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');

  // Reset and initialize data when content changes
  useEffect(() => {
    if (content) {
      setIsError(false);
      setErrorMessage('');
      
      // Auto-generate analytics when modal opens
      generateAnalytics();
    }
  }, [content, timeframe]);

  // Generate analytics with AI
  const generateAnalytics = async () => {
    if (!content) return;
    
    setIsLoading(true);
    setIsError(false);
    
    try {
      // Get analytics insights
      const result = await aiTools.generateInsights(timeframe, 'all');
      
      if (result?.data) {
        setInsights(result.data.insights || []);
        setPredictons(result.data.predictions || null);
      }
      
      // Get performance prediction
      const performance = await aiTools.predictContentPerformance(content.id, 30);
      setPerformanceData(performance);
      
      // Get anomalies detection
      const detectedAnomalies = await aiTools.detectAnomalies(timeframe, [content.id]);
      setAnomalies(detectedAnomalies || []);
      
    } catch (error) {
      console.error('Error generating analytics:', error);
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate analytics');
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-xl bg-white text-left align-middle shadow-xl transition-all">
                <div className="bg-gradient-to-r from-green-600 to-teal-500 px-6 py-4 flex justify-between items-center">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-white flex items-center">
                    <ChartBarIcon className="h-5 w-5 mr-2" />
                    AI Analytics Insights
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
                      <p className="mt-4 text-gray-600">Analyzing content performance and generating insights...</p>
                    </div>
                  ) : isError ? (
                    <div className="py-12 text-center">
                      <div className="text-red-500 mb-4">
                        {errorMessage || 'Something went wrong. Please try again.'}
                      </div>
                      <Button onClick={generateAnalytics}>Retry</Button>
                    </div>
                  ) : (
                    <>
                      {/* Content info and timeframe selector */}
                      <div className="mb-6 flex justify-between items-center">
                        <div>
                          {content && (
                            <div>
                              <h4 className="text-base font-medium">{content.title}</h4>
                              <p className="text-sm text-gray-500">
                                {content.type} • Created {formatDate(content.createdAt)}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex bg-gray-100 rounded-md p-1">
                          <button
                            className={`px-3 py-1 text-xs rounded-md ${timeframe === 'day' ? 'bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                            onClick={() => setTimeframe('day')}
                          >
                            Day
                          </button>
                          <button
                            className={`px-3 py-1 text-xs rounded-md ${timeframe === 'week' ? 'bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                            onClick={() => setTimeframe('week')}
                          >
                            Week
                          </button>
                          <button
                            className={`px-3 py-1 text-xs rounded-md ${timeframe === 'month' ? 'bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                            onClick={() => setTimeframe('month')}
                          >
                            Month
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6">
                        {/* Key insights panel */}
                        <div className="col-span-2">
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
                            <h4 className="text-sm font-medium mb-4 flex items-center">
                              <ChartBarIcon className="h-4 w-4 mr-1 text-green-600" />
                              Key Performance Insights
                            </h4>
                            
                            <ul className="space-y-3">
                              {insights.map((insight, index) => (
                                <li key={index} className="flex items-start text-sm">
                                  <CheckIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                  <span>{insight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* Performance prediction chart */}
                          {performanceData && (
                            <div className="border border-gray-200 rounded-lg p-5">
                              <h4 className="text-sm font-medium mb-4">Performance Forecast (30 Days)</h4>
                              
                              <div className="h-64 relative">
                                {/* Visualization would go here - using placeholder */}
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-md">
                                  <div className="text-center">
                                    <div className="text-green-600 text-2xl font-bold mb-2">
                                      {performanceData.confidence * 100}% Confidence
                                    </div>
                                    <p className="text-gray-500 text-sm">
                                      Forecast: {performanceData.predictedViews?.[29] || 0} views by {performanceData.labels?.[29] || ''}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="p-3 bg-green-50 border border-green-100 rounded-md">
                                  <h5 className="text-xs font-medium text-gray-600 mb-1">Avg. Daily Views</h5>
                                  <p className="text-green-600 text-lg font-medium">
                                    {performanceData.predictedViews ? 
                                      Math.round(performanceData.predictedViews.reduce((a: number, b: number) => a + b, 0) / performanceData.predictedViews.length) 
                                      : 0}
                                  </p>
                                </div>
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
                                  <h5 className="text-xs font-medium text-gray-600 mb-1">Engagement Rate</h5>
                                  <p className="text-blue-600 text-lg font-medium">
                                    {performanceData.predictedEngagement ? 
                                      (performanceData.predictedEngagement[performanceData.predictedEngagement.length - 1] * 100).toFixed(1) + '%'
                                      : '0%'}
                                  </p>
                                </div>
                                <div className="p-3 bg-purple-50 border border-purple-100 rounded-md">
                                  <h5 className="text-xs font-medium text-gray-600 mb-1">Conversion Est.</h5>
                                  <p className="text-purple-600 text-lg font-medium">
                                    {performanceData.predictedConversions ? 
                                      Math.round(performanceData.predictedConversions[performanceData.predictedConversions.length - 1])
                                      : 0}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Side panel with trends and anomalies */}
                        <div className="col-span-1">
                          {/* Trends section */}
                          {predictions && predictions.trends && (
                            <div className="border border-gray-200 rounded-lg p-4 mb-6">
                              <h4 className="text-sm font-medium mb-3">Trends</h4>
                              
                              {predictions.trends.upward && predictions.trends.upward.length > 0 && (
                                <div className="mb-3">
                                  <h5 className="text-xs font-medium text-gray-600 flex items-center mb-2">
                                    <ArrowUpIcon className="h-3 w-3 text-green-500 mr-1" />
                                    Upward Trends
                                  </h5>
                                  <ul className="space-y-1">
                                    {predictions.trends.upward.map((trend: string, index: number) => (
                                      <li key={index} className="text-xs text-gray-600 pl-4">
                                        {trend}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {predictions.trends.downward && predictions.trends.downward.length > 0 && (
                                <div className="mb-3">
                                  <h5 className="text-xs font-medium text-gray-600 flex items-center mb-2">
                                    <ArrowDownIcon className="h-3 w-3 text-red-500 mr-1" />
                                    Downward Trends
                                  </h5>
                                  <ul className="space-y-1">
                                    {predictions.trends.downward.map((trend: string, index: number) => (
                                      <li key={index} className="text-xs text-gray-600 pl-4">
                                        {trend}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {predictions.trends.stable && predictions.trends.stable.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-medium text-gray-600 flex items-center mb-2">
                                    <MinusIcon className="h-3 w-3 text-gray-500 mr-1" />
                                    Stable Metrics
                                  </h5>
                                  <ul className="space-y-1">
                                    {predictions.trends.stable.map((trend: string, index: number) => (
                                      <li key={index} className="text-xs text-gray-600 pl-4">
                                        {trend}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Anomalies section */}
                          <div className="border border-gray-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium mb-3">Detected Anomalies</h4>
                            
                            {anomalies.length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No anomalies detected in this time period.</p>
                            ) : (
                              <div className="space-y-3">
                                {anomalies.map((anomaly, index) => (
                                  <div key={index} className="p-3 border rounded-md bg-gray-50">
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center">
                                        <span className={`w-2 h-2 rounded-full mr-2 ${
                                          anomaly.severity === 'high' ? 'bg-red-500' :
                                          anomaly.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                        }`}></span>
                                        <span className="text-xs font-medium">{anomaly.metric}</span>
                                      </div>
                                      <span className={`text-xs font-medium ${
                                        anomaly.deviation > 0 ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {anomaly.deviation > 0 ? '+' : ''}{Math.round(anomaly.deviation * 100)}%
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2">{anomaly.recommendation}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actionable recommendations */}
                      {predictions && predictions.recommendations && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h4 className="text-sm font-medium mb-3">Recommended Actions</h4>
                          <div className="flex flex-wrap gap-2">
                            {predictions.recommendations.map((recommendation: string, index: number) => (
                              <div key={index} className="bg-green-50 text-green-800 px-3 py-2 rounded-md text-sm">
                                {recommendation}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button 
                    onClick={generateAnalytics}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Refresh Analysis
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

export default AIAnalyticsModal; 