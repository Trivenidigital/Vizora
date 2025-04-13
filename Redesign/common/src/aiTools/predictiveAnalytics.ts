import { 
  AIProvider, 
  AnalyticsInsightRequest, 
  AIResponse, 
  AnalyticsInsightResult,
  AIGenerationStatus
} from './types';

import { textGenerationService } from './textGeneration';

// User interaction profile model
interface UserInteractionProfile {
  viewDuration: number;
  clickRate: number;
  interests: string[];
  activeHours: string[];
  demographics?: {
    age?: string;
    gender?: string;
    location?: string;
  };
}

// Time slot prediction model
interface TimeSlotPrediction {
  startTime: Date;
  endTime: Date;
  confidence: number;
  metrics?: {
    expectedViews: number;
    expectedEngagement: number;
  };
  reason?: string;
}

// Content recommendation model
interface ContentRecommendation {
  contentId: string;
  title: string;
  confidence: number;
  reason?: string;
  tags?: string[];
}

/**
 * Predictive Analytics Service for AI-powered insights and forecasting
 */
class PredictiveAnalyticsService {
  private status: AIGenerationStatus = AIGenerationStatus.IDLE;
  private defaultProvider: AIProvider = AIProvider.INTERNAL;
  
  /**
   * Get current analysis status
   */
  getStatus(): AIGenerationStatus {
    return this.status;
  }

  /**
   * Generate insights from analytics data
   */
  async generateInsights(
    request: AnalyticsInsightRequest
  ): Promise<AIResponse<AnalyticsInsightResult>> {
    try {
      this.status = AIGenerationStatus.GENERATING;
      
      const startTime = Date.now();
      
      // Mock implementation for analytics insights
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Generate insights based on request parameters
      const insights = await this.createInsights(request);
      
      // Generate example metrics and predictions
      const metrics = this.generateExampleMetrics(request);
      const predictions = this.generateExamplePredictions(request);
      
      // Generate visualization data for charts
      const visualizationData = this.generateVisualizationData(request);
      
      const result: AnalyticsInsightResult = {
        insights,
        metrics,
        predictions,
        visualizationData
      };
      
      const processingTime = Date.now() - startTime;
      
      this.status = AIGenerationStatus.SUCCESS;
      
      return {
        success: true,
        data: result,
        processingTime,
        provider: request.provider || this.defaultProvider
      };
    } catch (error) {
      this.status = AIGenerationStatus.ERROR;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: request.provider || this.defaultProvider
      };
    }
  }

  /**
   * Create insights using text generation
   */
  private async createInsights(request: AnalyticsInsightRequest): Promise<string[]> {
    try {
      const timeframeText = this.getTimeframeText(request.timeframe, request.startDate, request.endDate);
      const metricTypeText = request.metricType === 'all' ? 'all metrics' : `${request.metricType} metrics`;
      const contentText = request.contentIds?.length 
        ? `for ${request.contentIds.length} content items` 
        : 'across all content';
      const displayText = request.displayIds?.length
        ? `on ${request.displayIds.length} displays`
        : 'across all displays';
      
      const prompt = `Generate 5 data-driven analytics insights for digital signage ${timeframeText} based on ${metricTypeText} ${contentText} ${displayText}.`;
      
      const response = await textGenerationService.generateText({
        prompt,
        type: 'analytical',
        provider: AIProvider.MOCK
      });
      
      if (response.success && response.data) {
        // Split text into separate insights
        const text = response.data.text;
        return text
          .split(/\d+\.\s/)
          .filter(Boolean)
          .map(insight => insight.trim());
      }
      
      // Fallback insights
      return this.getDefaultInsights(request);
    } catch (error) {
      console.error('Failed to generate analytics insights:', error);
      return this.getDefaultInsights(request);
    }
  }

  /**
   * Get default insights when text generation fails
   */
  private getDefaultInsights(request: AnalyticsInsightRequest): string[] {
    const isViews = request.metricType === 'all' || request.metricType === 'views';
    const isEngagement = request.metricType === 'all' || request.metricType === 'engagement';
    const isConversion = request.metricType === 'all' || request.metricType === 'conversion';
    
    const insights: string[] = [];
    
    if (isViews) {
      insights.push('View counts peaked on weekdays between 12-2pm, suggesting optimal scheduling during lunch hours.');
      insights.push('Content with dynamic elements received 37% more views than static content.');
    }
    
    if (isEngagement) {
      insights.push('Interactive content showed 2.1x higher engagement rates compared to passive content.');
      insights.push('Average view duration increased by 18% when content included human faces or characters.');
    }
    
    if (isConversion) {
      insights.push('Promotional content with clear calls-to-action had 43% higher conversion rates.');
      insights.push('Displays in high-traffic areas showed 3.5x better conversion performance than low-traffic locations.');
    }
    
    // General insights
    insights.push('Content refresh frequency of 2-3 weeks maintains optimal audience attention levels.');
    
    return insights;
  }

  /**
   * Generate example metrics for the given request
   */
  private generateExampleMetrics(request: AnalyticsInsightRequest): Record<string, any> {
    const timeframe = request.timeframe;
    const metricType = request.metricType || 'all';
    
    const metrics: Record<string, any> = {
      timeframe,
      totalDisplays: request.displayIds?.length || 8,
      totalContent: request.contentIds?.length || 24
    };
    
    if (metricType === 'all' || metricType === 'views') {
      metrics.views = {
        total: 25000 + Math.floor(Math.random() * 15000),
        average: 450 + Math.floor(Math.random() * 250),
        trend: Math.random() > 0.7 ? 'declining' : 'increasing',
        percentChange: 5 + Math.floor(Math.random() * 20)
      };
    }
    
    if (metricType === 'all' || metricType === 'engagement') {
      metrics.engagement = {
        averageDuration: 8.5 + (Math.random() * 3).toFixed(1),
        interactionRate: (0.12 + Math.random() * 0.08).toFixed(2),
        repeatViews: 1.8 + (Math.random() * 0.4).toFixed(1),
        percentChange: 7 + Math.floor(Math.random() * 15)
      };
    }
    
    if (metricType === 'all' || metricType === 'conversion') {
      metrics.conversion = {
        rate: (0.05 + Math.random() * 0.03).toFixed(2),
        totalActions: 850 + Math.floor(Math.random() * 350),
        costPerAction: (1.25 + Math.random() * 0.75).toFixed(2),
        percentChange: 3 + Math.floor(Math.random() * 12)
      };
    }
    
    return metrics;
  }

  /**
   * Generate example predictions for the given request
   */
  private generateExamplePredictions(request: AnalyticsInsightRequest): Record<string, any> {
    const timeframe = request.timeframe;
    
    const predictions: Record<string, any> = {
      nextPeriod: {
        expectedViews: 28000 + Math.floor(Math.random() * 8000),
        expectedEngagement: (0.15 + Math.random() * 0.05).toFixed(2),
        expectedConversions: 950 + Math.floor(Math.random() * 250),
        confidence: (0.75 + Math.random() * 0.2).toFixed(2)
      },
      trends: {
        upward: ['weekend engagement', 'mobile interaction', 'promotional content effectiveness'],
        downward: ['early morning views', 'static content performance'],
        stable: ['overall conversion rate', 'lunchtime peak traffic']
      },
      recommendations: [
        'Increase promotional content during peak hours',
        'Reduce static content in favor of interactive elements',
        'Consider A/B testing for calls-to-action'
      ]
    };
    
    // Add seasonality if timeframe is month or longer
    if (timeframe === 'month' || timeframe === 'custom') {
      predictions.seasonality = {
        patterns: [
          { day: 'Monday', trend: 'moderate increase' },
          { day: 'Friday', trend: 'significant increase' },
          { time: '12-2pm', trend: 'peak performance' },
          { time: '8-10am', trend: 'moderate performance' }
        ],
        upcoming: [
          { event: 'End of Month', impact: 'Positive', confidenceScore: 0.82 },
          { event: 'Weekend', impact: 'Neutral', confidenceScore: 0.91 }
        ]
      };
    }
    
    return predictions;
  }

  /**
   * Generate visualization data for charts
   */
  private generateVisualizationData(request: AnalyticsInsightRequest): any {
    const timeframe = request.timeframe;
    const days = timeframe === 'day' ? 1 : 
                timeframe === 'week' ? 7 : 
                timeframe === 'month' ? 30 : 
                14; // Default for custom
    
    const labels: string[] = [];
    const viewsData: number[] = [];
    const engagementData: number[] = [];
    const conversionData: number[] = [];
    
    // Generate date labels and data points
    const baseDate = request.startDate || new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - (days - i - 1));
      
      // Format date as MM/DD
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      labels.push(label);
      
      // Generate random data with some patterns
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Views tend to be lower on weekends
      const viewsBase = isWeekend ? 600 : 1000;
      viewsData.push(viewsBase + Math.floor(Math.random() * 400));
      
      // Engagement might be higher on weekends
      const engagementBase = isWeekend ? 0.16 : 0.12;
      engagementData.push(parseFloat((engagementBase + Math.random() * 0.08).toFixed(2)));
      
      // Conversions follow views pattern mostly
      const conversionBase = isWeekend ? 25 : 40;
      conversionData.push(conversionBase + Math.floor(Math.random() * 15));
    }
    
    return {
      timeSeriesData: {
        labels,
        datasets: [
          {
            label: 'Views',
            data: viewsData,
            fill: false,
            borderColor: '#4285F4'
          },
          {
            label: 'Engagement Rate',
            data: engagementData,
            fill: false,
            borderColor: '#34A853'
          },
          {
            label: 'Conversions',
            data: conversionData,
            fill: false,
            borderColor: '#EA4335'
          }
        ]
      },
      // Add more visualization data as needed
      contentPerformance: {
        labels: ['Content A', 'Content B', 'Content C', 'Content D', 'Content E'],
        datasets: [
          {
            label: 'Performance Score',
            data: [85, 72, 93, 68, 79],
            backgroundColor: ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#5F6368']
          }
        ]
      },
      displayDistribution: {
        labels: ['Morning', 'Afternoon', 'Evening', 'Night'],
        datasets: [
          {
            label: 'Views Distribution',
            data: [25, 40, 30, 5],
            backgroundColor: ['#4285F4', '#34A853', '#FBBC05', '#EA4335']
          }
        ]
      }
    };
  }

  /**
   * Get text description of timeframe for prompts
   */
  private getTimeframeText(
    timeframe: 'day' | 'week' | 'month' | 'custom',
    startDate?: Date,
    endDate?: Date
  ): string {
    switch (timeframe) {
      case 'day':
        return 'over the past day';
      case 'week':
        return 'over the past week';
      case 'month':
        return 'over the past month';
      case 'custom':
        if (startDate && endDate) {
          return `from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
        }
        return 'for the custom period';
      default:
        return 'for the selected period';
    }
  }

  /**
   * Predict future performance for specific content
   */
  async predictContentPerformance(
    contentId: string,
    dayCount: number = 30
  ): Promise<{
    predictedViews: number[];
    predictedEngagement: number[];
    predictedConversions: number[];
    labels: string[];
    confidence: number;
  }> {
    try {
      console.log(`Predicting performance for content ID: ${contentId} over next ${dayCount} days`);
      
      // This would use actual historical data and ML models in a real implementation
      // For now, we'll generate some example predictions
      
      // Use contentId to seed a consistent random pattern
      const contentSeed = contentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      // Use the seed for consistent random numbers
      const seedRandom = (min: number, max: number) => {
        const seed = (contentSeed * 9301 + 49297) % 233280;
        return min + (seed / 233280) * (max - min);
      };
      
      const labels: string[] = [];
      const predictedViews: number[] = [];
      const predictedEngagement: number[] = [];
      const predictedConversions: number[] = [];
      
      const today = new Date();
      const baseViews = 500 + Math.floor(seedRandom(0, 300));
      const baseEngagement = 0.08 + Math.random() * 0.04;
      const baseConversions = 20 + Math.floor(Math.random() * 15);
      
      // Generate predictions for each day
      for (let i = 0; i < dayCount; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        // Format date as MM/DD
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        labels.push(label);
        
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Apply some patterns: weekends have different patterns, and there's a general trend
        const dayFactor = isWeekend ? 0.8 : 1.0;
        const trendFactor = 1.0 + (i * 0.005); // Slight upward trend
        
        // Add some weekly patterns and randomness
        const weekPattern = Math.sin((i % 7) / 7 * Math.PI) * 0.2 + 1;
        const randomFactor = 0.9 + Math.random() * 0.2;
        
        const combinedFactor = dayFactor * trendFactor * weekPattern * randomFactor;
        
        predictedViews.push(Math.round(baseViews * combinedFactor));
        predictedEngagement.push(parseFloat((baseEngagement * combinedFactor).toFixed(3)));
        predictedConversions.push(Math.round(baseConversions * combinedFactor));
      }
      
      return {
        labels,
        predictedViews,
        predictedEngagement,
        predictedConversions,
        confidence: 0.85 // Confidence score for the prediction
      };
    } catch (error) {
      console.error('Failed to predict content performance:', error);
      throw new Error('Failed to generate performance prediction');
    }
  }
  
  /**
   * Identify content performance anomalies
   */
  async detectAnomalies(
    timeframe: 'day' | 'week' | 'month',
    contentIds?: string[],
    displayIds?: string[]
  ): Promise<Array<{
    contentId?: string;
    displayId?: string;
    metric: string;
    value: number;
    expectedValue: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
    recommendation?: string;
  }>> {
    console.log(`Detecting anomalies for ${timeframe} timeframe`);
    
    // Adjust time range based on timeframe
    const now = new Date();
    const timeRangeStart = new Date();
    
    switch(timeframe) {
      case 'day':
        timeRangeStart.setHours(now.getHours() - 24);
        break;
      case 'week':
        timeRangeStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        timeRangeStart.setMonth(now.getMonth() - 1);
        break;
    }
    
    // This would use actual analytics data in a real implementation
    // For now, we'll generate some example anomalies
    
    const anomalies = [];
    const metrics = ['views', 'engagement', 'conversion', 'interaction'];
    const contentIdList = contentIds || ['content-1', 'content-2', 'content-3'];
    const displayIdList = displayIds || ['display-1', 'display-2'];
    
    // Generate a random number of anomalies
    const anomalyCount = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < anomalyCount; i++) {
      const metric = metrics[Math.floor(Math.random() * metrics.length)];
      const useContent = Math.random() > 0.5;
      
      const deviation = 0.3 + Math.random() * 0.5; // 30-80% deviation
      const severity: 'low' | 'medium' | 'high' = 
        deviation < 0.4 ? 'low' : 
        deviation < 0.6 ? 'medium' : 'high';
      
      // Higher or lower than expected
      const direction = Math.random() > 0.5 ? 1 : -1;
      
      // Values depend on the metric
      let expectedValue, value;
      switch (metric) {
        case 'views':
          expectedValue = 500 + Math.floor(Math.random() * 500);
          value = Math.round(expectedValue * (1 + direction * deviation));
          break;
        case 'engagement':
          expectedValue = parseFloat((0.1 + Math.random() * 0.1).toFixed(2));
          value = parseFloat((expectedValue * (1 + direction * deviation)).toFixed(2));
          break;
        case 'conversion':
          expectedValue = 20 + Math.floor(Math.random() * 30);
          value = Math.round(expectedValue * (1 + direction * deviation));
          break;
        case 'interaction':
          expectedValue = 50 + Math.floor(Math.random() * 50);
          value = Math.round(expectedValue * (1 + direction * deviation));
          break;
        default:
          expectedValue = 100;
          value = Math.round(expectedValue * (1 + direction * deviation));
      }
      
      // Generate a recommendation based on the anomaly
      let recommendation;
      if (direction > 0) {
        recommendation = `Unusually high ${metric} detected. Consider ${
          metric === 'views' ? 'expanding this content to more displays' :
          metric === 'engagement' ? 'analyzing elements that drive this exceptional engagement' :
          metric === 'conversion' ? 'increasing promotion for this high-converting content' :
          'replicating these interactive elements in other content'
        }.`;
      } else {
        recommendation = `Unusually low ${metric} detected. Consider ${
          metric === 'views' ? 'reviewing display placement or scheduling' :
          metric === 'engagement' ? 'refreshing content or adding more interactive elements' :
          metric === 'conversion' ? 'enhancing call-to-action visibility or offer appeal' :
          'redesigning interactive elements for better usability'
        }.`;
      }
      
      anomalies.push({
        contentId: useContent ? contentIdList[Math.floor(Math.random() * contentIdList.length)] : undefined,
        displayId: !useContent ? displayIdList[Math.floor(Math.random() * displayIdList.length)] : undefined,
        metric,
        value,
        expectedValue,
        deviation: parseFloat((deviation * direction).toFixed(2)),
        severity,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000)), // Random time in last 24 hours
        recommendation
      });
    }
    
    return anomalies;
  }

  /**
   * Generate content recommendations
   */
  async generateContentRecommendations(
    contentId: string,
    displayId: string,
    currentUserProfile: UserInteractionProfile
  ): Promise<ContentRecommendation[]> {
    console.log(`Generating content recommendations based on content ${contentId} for display ${displayId}`);
    
    try {
      // Mock implementation for recommendations
      const recommendations: ContentRecommendation[] = [];
      
      // Use user profile to enhance recommendations if available
      const userInterests = currentUserProfile?.interests || [];
      
      // Generate a few mock recommendations
      for (let i = 0; i < 5; i++) {
        // Use user profile data to adjust confidence
        let confidence = 0.95 - (i * 0.1);
        
        // Boost confidence if user interests align with recommendation
        if (userInterests.includes(`interest-${i}`)) {
          confidence = Math.min(confidence + 0.1, 0.99);
        }
        
        recommendations.push({
          contentId: `content-${100 + i}`,
          title: `Recommended Content ${i + 1}`,
          confidence,
          reason: i === 0 ? 'Similar content type with high engagement' :
                  i === 1 ? 'Popular with similar audience demographics' :
                  i === 2 ? 'Strong performance in this location type' :
                  i === 3 ? 'Complements current content in rotation' :
                  'Matches viewing patterns for this display',
          tags: userInterests.length > 0 ? userInterests.slice(0, 3) : undefined
        });
      }
      
      return recommendations;
    } catch (error) {
      console.error('Failed to generate content recommendations:', error);
      return [];
    }
  }

  /**
   * Predict best time to display content
   */
  async predictBestTimeToDisplay(
    contentType: string,
    displayId: string,
    timeframe: 'day' | 'week' | 'month',
    userInteractions?: UserInteractionProfile
  ): Promise<TimeSlotPrediction[]> {
    console.log(`Predicting best ${timeframe} time slots for ${contentType} content on display ${displayId}`);
    
    try {
      // This would use ML models in a real implementation
      // For now, we'll generate example time slots
      
      const predictions: TimeSlotPrediction[] = [];
      const now = new Date();
      const daysToPredict = timeframe === 'day' ? 1 : 
                          timeframe === 'week' ? 7 : 30;
      
      // Use user interactions to tailor predictions if available
      const userActiveHours = userInteractions?.activeHours || [];
      
      // Peak hours by day of week (0 = Sunday)
      // Adjust based on user interactions if available
      let peakHoursByDay: Record<number, number[]> = {
        0: [13, 15, 17], // Sunday
        1: [9, 12, 17],  // Monday
        2: [9, 12, 17],  // Tuesday
        3: [9, 12, 17],  // Wednesday
        4: [9, 12, 17],  // Thursday
        5: [9, 12, 18],  // Friday
        6: [12, 15, 18]  // Saturday
      };
      
      // If we have user active hours, incorporate them into predictions
      if (userActiveHours.length > 0) {
        // Parse hours like "09:00-11:00" into actual hour numbers
        const userPeakHours = userActiveHours.flatMap(timeRange => {
          const hourMatch = timeRange.match(/(\d{1,2}):00-(\d{1,2}):00/);
          if (hourMatch) {
            const startHour = parseInt(hourMatch[1], 10);
            const endHour = parseInt(hourMatch[2], 10);
            // Create an array of hours in the range
            return Array.from(
              { length: endHour - startHour }, 
              (_, i) => startHour + i
            );
          }
          return [];
        });
        
        // If we found valid hours, override some of the default peak hours
        if (userPeakHours.length > 0) {
          // Apply to all days for simplicity
          for (let day = 0; day < 7; day++) {
            // Mix default and user peak hours, prioritizing user hours
            peakHoursByDay[day] = [
              ...userPeakHours.slice(0, 2),
              ...peakHoursByDay[day].filter(h => !userPeakHours.includes(h)).slice(0, 1)
            ];
          }
        }
      }
      
      // Generate predictions for each day
      for (let i = 0; i < daysToPredict; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        const dayOfWeek = date.getDay();
        
        // Get peak hours for this day
        const peakHours = peakHoursByDay[dayOfWeek];
        
        // Generate slots for peak hours with high confidence
        for (const hour of peakHours) {
          const startTime = new Date(date);
          startTime.setHours(hour, 0, 0, 0);
          
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + 30); // 30 minute slot
          
          predictions.push({
            startTime,
            endTime,
            confidence: 0.8 + Math.random() * 0.15,
            metrics: {
              expectedViews: 50 + Math.floor(Math.random() * 100),
              expectedEngagement: parseFloat((0.1 + Math.random() * 0.15).toFixed(2))
            },
            reason: this.getTimeSlotReason(hour, dayOfWeek, contentType)
          });
        }
        
        // Add a few off-peak hours with lower confidence
        const offPeakHours = [10, 14, 16, 19].filter(h => !peakHours.includes(h));
        for (let j = 0; j < 2; j++) {
          const hourIndex = Math.floor(Math.random() * offPeakHours.length);
          const hour = offPeakHours[hourIndex];
          
          const startTime = new Date(date);
          startTime.setHours(hour, 0, 0, 0);
          
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + 30);
          
          predictions.push({
            startTime,
            endTime,
            confidence: 0.5 + Math.random() * 0.2,
            metrics: {
              expectedViews: 20 + Math.floor(Math.random() * 50),
              expectedEngagement: parseFloat((0.05 + Math.random() * 0.1).toFixed(2))
            },
            reason: this.getTimeSlotReason(hour, dayOfWeek, contentType) + ' (Alternative time slot)'
          });
        }
      }
      
      // Sort by confidence (highest first)
      return predictions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Failed to predict best time slots:', error);
      return [];
    }
  }
  
  /**
   * Get reason text for a time slot prediction
   */
  private getTimeSlotReason(hour: number, dayOfWeek: number, contentType: string): string {
    const timeDesc = hour < 12 ? 'morning' : 
                    hour < 17 ? 'afternoon' : 'evening';
                    
    const dayDesc = ['weekend', 'weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'weekend'][dayOfWeek];
    
    const contentTypeReason = contentType === 'promotional' ? 'promotional content performs well' :
                            contentType === 'entertainment' ? 'entertainment content has high engagement' :
                            contentType === 'informational' ? 'informational content receives good attention' :
                            'content typically has good performance';
                            
    return `${timeDesc} ${dayDesc} slot when ${contentTypeReason}`;
  }
}

// Export singleton instance
export const predictiveAnalyticsService = new PredictiveAnalyticsService();

// Export functions for direct usage
export const generateInsights = (
  request: AnalyticsInsightRequest
): Promise<AIResponse<AnalyticsInsightResult>> => {
  return predictiveAnalyticsService.generateInsights(request);
};

export const predictContentPerformance = (
  contentId: string,
  dayCount?: number
): Promise<any> => {
  return predictiveAnalyticsService.predictContentPerformance(contentId, dayCount);
};

export const detectAnomalies = (
  timeframe: 'day' | 'week' | 'month',
  contentIds?: string[],
  displayIds?: string[]
): Promise<any[]> => {
  return predictiveAnalyticsService.detectAnomalies(timeframe, contentIds, displayIds);
}; 