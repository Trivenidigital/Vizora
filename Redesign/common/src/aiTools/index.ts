/**
 * AI Tools Module
 * Common AI functionality for Vizora applications
 */

// Export all modules
export * as textGeneration from './textGeneration';
export * as imageGeneration from './imageGeneration';
export * as contentEnhancement from './contentEnhancement';
export * as schedulingAI from './schedulingAI';
export * as predictiveAnalytics from './predictiveAnalytics';
export * from './types';

// Export consolidated module with all tools
export const aiTools = {
  // Text generation
  generateText: async (prompt: string, type?: string) => {
    const { generateText } = await import('./textGeneration');
    return generateText({ prompt, type: type as any });
  },
  
  // Image generation
  generateImage: async (prompt: string, width?: number, height?: number) => {
    const { generateImage } = await import('./imageGeneration');
    return generateImage(prompt, width, height);
  },
  
  // Content enhancement
  enhanceMetadata: async (content: any) => {
    const { enhanceMetadata } = await import('./contentEnhancement');
    return enhanceMetadata(content);
  },
  
  // Scheduling
  getScheduleRecommendations: async (contentId: string, startDate: Date, endDate: Date) => {
    const { getRecommendationsForDateRange } = await import('./schedulingAI');
    return getRecommendationsForDateRange(contentId, startDate, endDate);
  },
  
  // Analytics
  generateInsights: async (timeframe: 'day' | 'week' | 'month', metricType?: string) => {
    const { generateInsights } = await import('./predictiveAnalytics');
    return generateInsights({ timeframe, metricType: metricType as any });
  }
};

// Version info
export const VERSION = '1.0.0'; 