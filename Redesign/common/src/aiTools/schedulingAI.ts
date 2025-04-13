import { 
  AIProvider, 
  ScheduleRecommendationRequest, 
  ScheduleRecommendationResult,
  AIResponse,
  AIGenerationStatus
} from './types';

import { textGenerationService } from './textGeneration';

/**
 * Smart Scheduling Service for AI-powered content scheduling
 */
class SchedulingAIService {
  private status: AIGenerationStatus = AIGenerationStatus.IDLE;
  private defaultProvider: AIProvider = AIProvider.INTERNAL;

  /**
   * Get current scheduling status
   */
  getStatus(): AIGenerationStatus {
    return this.status;
  }

  /**
   * Get optimal schedule recommendations for content
   */
  async getScheduleRecommendations(
    request: ScheduleRecommendationRequest
  ): Promise<AIResponse<ScheduleRecommendationResult>> {
    try {
      this.status = AIGenerationStatus.GENERATING;
      
      const startTime = Date.now();
      
      // Mock implementation for schedule recommendations
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate time slots based on content metadata and display information
      const contentInfo = request.contentMetadata || {};
      const displayInfo = request.displayMetadata || {};
      const startDate = request.startDate || new Date();
      const endDate = request.endDate || new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Default 1 week
      
      // Generate some mock recommendations
      const recommendations = this.generateTimeSlots(startDate, endDate, contentInfo, displayInfo);
      
      // Generate insights
      const insights = await this.generateScheduleInsights(
        request.contentId,
        recommendations,
        contentInfo,
        displayInfo
      );
      
      const result: ScheduleRecommendationResult = {
        recommendations,
        suggestedDuration: this.calculateOptimalDuration(contentInfo),
        suggestedFrequency: this.calculateOptimalFrequency(contentInfo, displayInfo),
        insights
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
   * Generate time slots based on provided parameters
   */
  private generateTimeSlots(
    startDate: Date,
    endDate: Date,
    contentInfo: Record<string, any>,
    displayInfo: Record<string, any>
  ) {
    const slots = [];
    const contentType = contentInfo.type || 'standard';
    const peakHours = displayInfo.peakHours || [9, 12, 17]; // Default peak hours
    const currentDate = new Date(startDate);
    
    // Determine how many slots to generate based on content type
    const slotsPerDay = contentType === 'promotional' ? 3 : 
                        contentType === 'announcement' ? 5 :
                        contentType === 'emergency' ? 12 : 2;
    
    while (currentDate < endDate) {
      // Skip certain days if needed (like weekends for business content)
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (contentType === 'business' && isWeekend) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Generate slots for this day
      for (let i = 0; i < slotsPerDay; i++) {
        // Use peak hours for some slots
        let hour: number;
        let confidence: number;
        
        if (i < peakHours.length) {
          // Use peak hours with high confidence
          hour = peakHours[i];
          confidence = 0.85 + (Math.random() * 0.15); // 0.85-1.0
        } else {
          // Use random hours with lower confidence
          hour = 8 + Math.floor(Math.random() * 12); // 8am-8pm
          confidence = 0.5 + (Math.random() * 0.35); // 0.5-0.85
        }
        
        const startTime = new Date(currentDate);
        startTime.setHours(hour, 0, 0, 0);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + this.calculateOptimalDuration(contentInfo));
        
        slots.push({
          startTime,
          endTime,
          confidence,
          reason: this.getReasonForTimeSlot(hour, dayOfWeek, contentType)
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Sort by confidence
    return slots.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get reason for time slot selection
   */
  private getReasonForTimeSlot(hour: number, dayOfWeek: number, contentType: string): string {
    // Base reasons by time of day
    let baseReason = '';
    if (hour >= 9 && hour <= 11) {
      baseReason = 'Morning peak traffic time with high audience engagement';
    } else if (hour >= 12 && hour <= 14) {
      baseReason = 'Lunch hour with increased foot traffic';
    } else if (hour >= 17 && hour <= 19) {
      baseReason = 'Evening rush with highest conversion potential';
    } else if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 18) {
      baseReason = 'Business hours with steady audience flow';
    } else {
      baseReason = 'Moderate traffic period with targeted audience segment';
    }
    
    // Add content-specific context
    switch (contentType) {
      case 'promotional':
        return `${baseReason}. Ideal for promotional content with high visibility.`;
      case 'announcement':
        return `${baseReason}. Good timing for announcements to reach maximum audience.`;
      case 'emergency':
        return `${baseReason}. Critical time slot for emergency messaging.`;
      case 'business':
        return `${baseReason}. Optimal for business-oriented messaging.`;
      default:
        return baseReason;
    }
  }

  /**
   * Calculate optimal duration for content
   */
  private calculateOptimalDuration(contentInfo: Record<string, any>): number {
    const contentType = contentInfo.type || 'standard';
    const baseContent = contentInfo.hasVideo ? 45 : 30;
    
    // Adjust duration based on content type
    switch (contentType) {
      case 'promotional':
        return baseContent * 1.5;
      case 'announcement':
        return baseContent;
      case 'emergency':
        return baseContent * 2;
      default:
        return baseContent;
    }
  }

  /**
   * Calculate optimal frequency for content
   */
  private calculateOptimalFrequency(
    contentInfo: Record<string, any>,
    displayInfo: Record<string, any>
  ): string {
    const contentType = contentInfo.type || 'standard';
    const displayLocation = displayInfo.location || 'standard';
    
    // Determine frequency based on content type and display location
    if (contentType === 'emergency') {
      return 'every 30 minutes';
    } else if (contentType === 'promotional' && displayLocation === 'high-traffic') {
      return 'hourly';
    } else if (contentType === 'announcement') {
      return '3 times daily';
    } else {
      return 'twice daily';
    }
  }

  /**
   * Generate insights for schedule
   */
  private async generateScheduleInsights(
    contentId: string,
    recommendations: any[],
    contentInfo: Record<string, any>,
    displayInfo: Record<string, any>
  ): Promise<string[]> {
    try {
      const contentContext = [
        `Content ID: ${contentId}`,
        `Type: ${contentInfo.type || 'standard'}`,
        `Duration: ${contentInfo.duration || 'unknown'}`,
        `Target audience: ${contentInfo.audience || 'general'}`
      ].join(', ');
      
      const displayContext = [
        `Location: ${displayInfo.location || 'unknown'}`,
        `Traffic: ${displayInfo.traffic || 'moderate'}`,
        `Screen size: ${displayInfo.screenSize || 'standard'}`
      ].join(', ');
      
      const scheduleContext = `Recommended ${recommendations.length} time slots with average confidence of ${
        Math.round(
          recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / 
          recommendations.length * 100
        ) / 100
      }`;
      
      // Use text generation service to create insights
      const prompt = `Generate 3 insights about schedule optimization for digital signage content. Content details: ${contentContext}. Display details: ${displayContext}. Schedule details: ${scheduleContext}`;
      
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
      
      // Fallback insights if text generation fails
      return [
        'Content performs best during peak business hours when traffic is highest',
        'Consider increasing frequency during promotional periods for better engagement',
        'Scheduling during lunch hours may improve viewer retention rates'
      ];
    } catch (error) {
      console.error('Failed to generate schedule insights:', error);
      return [
        'Schedule optimized for maximum audience exposure',
        'Time slots selected based on historical performance data',
        'Recommended frequency adjusted for content type and display location'
      ];
    }
  }
  
  /**
   * Get schedule recommendations for a specific date range
   */
  async getRecommendationsForDateRange(
    contentId: string,
    startDate: Date,
    endDate: Date,
    displayId?: string
  ): Promise<ScheduleRecommendationResult> {
    const response = await this.getScheduleRecommendations({
      contentId,
      displayId,
      startDate,
      endDate
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate schedule recommendations');
    }
    
    return response.data;
  }
  
  /**
   * Generate an optimized schedule for multiple content items
   */
  async createOptimizedSchedule(
    contentItems: Array<{ id: string; priority?: number; metadata?: Record<string, any> }>,
    startDate: Date,
    endDate: Date,
    displayId?: string
  ): Promise<Array<{
    contentId: string;
    startTime: Date;
    endTime: Date;
    score: number;
  }>> {
    try {
      // Sort content by priority
      const sortedContent = [...contentItems].sort((a, b) => 
        (b.priority || 0) - (a.priority || 0)
      );
      
      const allSlots: Array<{
        contentId: string;
        startTime: Date;
        endTime: Date;
        score: number;
      }> = [];
      
      // Get recommendations for each content and merge
      for (const content of sortedContent) {
        const recommendations = await this.getScheduleRecommendations({
          contentId: content.id,
          displayId,
          startDate,
          endDate,
          contentMetadata: content.metadata
        });
        
        if (recommendations.success && recommendations.data) {
          // Add these slots to our total, transforming to the right format
          const slots = recommendations.data.recommendations.map(rec => ({
            contentId: content.id,
            startTime: rec.startTime,
            endTime: rec.endTime,
            score: rec.confidence * (content.priority || 1) // Adjust score by priority
          }));
          
          allSlots.push(...slots);
        }
      }
      
      // Sort all slots by score
      allSlots.sort((a, b) => b.score - a.score);
      
      // Remove overlapping slots, prioritizing higher scores
      const finalSchedule: typeof allSlots = [];
      
      for (const slot of allSlots) {
        // Check if this slot overlaps with any already in the schedule
        const overlaps = finalSchedule.some(existingSlot => 
          (slot.startTime < existingSlot.endTime && slot.endTime > existingSlot.startTime)
        );
        
        if (!overlaps) {
          finalSchedule.push(slot);
        }
      }
      
      return finalSchedule;
    } catch (error) {
      console.error('Failed to create optimized schedule:', error);
      return [];
    }
  }
}

// Export singleton instance
export const schedulingAIService = new SchedulingAIService();

// Export functions for direct usage
export const getScheduleRecommendations = (
  request: ScheduleRecommendationRequest
): Promise<AIResponse<ScheduleRecommendationResult>> => {
  return schedulingAIService.getScheduleRecommendations(request);
};

export const getRecommendationsForDateRange = (
  contentId: string,
  startDate: Date,
  endDate: Date,
  displayId?: string
): Promise<ScheduleRecommendationResult> => {
  return schedulingAIService.getRecommendationsForDateRange(contentId, startDate, endDate, displayId);
};

export const createOptimizedSchedule = (
  contentItems: Array<{ id: string; priority?: number; metadata?: Record<string, any> }>,
  startDate: Date,
  endDate: Date,
  displayId?: string
): Promise<Array<{
  contentId: string;
  startTime: Date;
  endTime: Date;
  score: number;
}>> => {
  return schedulingAIService.createOptimizedSchedule(contentItems, startDate, endDate, displayId);
}; 