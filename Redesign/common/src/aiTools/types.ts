/**
 * Common types for AI functionality
 */

/**
 * AI Provider type
 */
export enum AIProvider {
  OPENAI = 'openai',
  STABILITY = 'stability',
  INTERNAL = 'internal',
  MOCK = 'mock'
}

/**
 * AI Generation Status
 */
export enum AIGenerationStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Base AI Request properties
 */
export interface AIBaseRequest {
  provider?: AIProvider;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Image Generation Request
 */
export interface ImageGenerationRequest extends AIBaseRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  style?: string;
  numberOfImages?: number;
  seed?: number;
}

/**
 * Image Enhancement Request
 */
export interface ImageEnhancementRequest extends AIBaseRequest {
  imageData: Blob | string; // Can be a blob or a base64 string
  enhancementType: 'upscale' | 'removeBackground' | 'colorize' | 'restore';
  scale?: number; // For upscaling
  parameters?: Record<string, any>; // Additional parameters for the enhancement
}

/**
 * Video Generation Request
 */
export interface VideoGenerationRequest extends AIBaseRequest {
  prompt: string;
  duration?: number; // in seconds
  resolution?: string;
  logo?: Blob | string; // Optional logo to overlay
  textOverlays?: TextOverlay[];
  audioTrack?: string; // Optional audio track URL or identifier
  style?: string;
}

/**
 * Text Overlay for video generation
 */
export interface TextOverlay {
  text: string;
  startTime: number; // seconds from start
  endTime: number; // seconds from start
  position: 'top' | 'center' | 'bottom' | [number, number]; // percentage or predefined position
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    opacity?: number;
    animation?: 'fade' | 'slide' | 'none';
  };
}

/**
 * Text Generation Request
 */
export interface TextGenerationRequest extends AIBaseRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  type?: 'title' | 'description' | 'tags' | 'creative' | 'analytical';
}

/**
 * Schedule Recommendation Request
 */
export interface ScheduleRecommendationRequest extends AIBaseRequest {
  contentId: string;
  displayId?: string;
  startDate?: Date;
  endDate?: Date;
  existingSchedule?: any[]; // Array of existing schedule entries
  contentMetadata?: Record<string, any>; // Content metadata for context
  displayMetadata?: Record<string, any>; // Display metadata for context
}

/**
 * Analytics Insights Request
 */
export interface AnalyticsInsightRequest extends AIBaseRequest {
  timeframe: 'day' | 'week' | 'month' | 'custom';
  startDate?: Date;
  endDate?: Date;
  metricType?: 'views' | 'engagement' | 'conversion' | 'all';
  displayIds?: string[];
  contentIds?: string[];
}

/**
 * AI Response Interface
 */
export interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime?: number; // ms
  provider?: AIProvider;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

/**
 * Image Generation Result
 */
export interface ImageGenerationResult {
  images: Array<{
    url?: string;
    base64Data?: string;
    width: number;
    height: number;
    seed?: number;
    promptStrength?: number;
  }>;
  prompt: string;
  metadata?: Record<string, any>;
}

/**
 * Video Generation Result
 */
export interface VideoGenerationResult {
  videoUrl?: string;
  videoFile?: Blob;
  thumbnailUrl?: string;
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * Image Enhancement Result
 */
export interface ImageEnhancementResult {
  enhancedImageUrl?: string;
  enhancedImageData?: string; // Base64
  width: number;
  height: number;
  enhancementType: string;
  metadata?: Record<string, any>;
}

/**
 * Text Generation Result
 */
export interface TextGenerationResult {
  text: string;
  type?: string;
  alternatives?: string[];
}

/**
 * Schedule Recommendation Result
 */
export interface ScheduleRecommendationResult {
  recommendations: Array<{
    startTime: Date;
    endTime: Date;
    confidence: number; // 0-1
    reason?: string;
  }>;
  suggestedDuration?: number;
  suggestedFrequency?: string;
  insights?: string[];
}

/**
 * Analytics Insight Result
 */
export interface AnalyticsInsightResult {
  insights: string[];
  metrics?: Record<string, any>;
  predictions?: Record<string, any>;
  visualizationData?: any;
}

/**
 * Content Performance Score
 */
export interface ContentPerformanceScore {
  contentId: string;
  overallScore: number; // 0-100
  metrics: {
    engagement?: number;
    viewTime?: number;
    relevance?: number;
    seasonality?: number;
    targeting?: number;
  };
  recommendations?: string[];
  timestamp: Date;
}

/**
 * AI Assistant Context
 */
export interface AIAssistantContext {
  userPrompt: string;
  contextType: 'content' | 'scheduling' | 'analytics' | 'general';
  data?: any;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * AI Model Configuration
 */
export interface AIModelConfig {
  provider: AIProvider;
  apiKey?: string;
  apiEndpoint?: string;
  modelName?: string;
  defaultParameters?: Record<string, any>;
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
} 