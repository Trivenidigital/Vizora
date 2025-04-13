import { 
  AIProvider, 
  ImageEnhancementRequest,
  AIResponse, 
  ImageEnhancementResult,
  ContentPerformanceScore,
  AIGenerationStatus
} from './types';

import { textGenerationService } from './textGeneration';
import { imageGenerationService } from './imageGeneration';

/**
 * Content Enhancement Service for AI-powered content improvements
 */
class ContentEnhancementService {
  private status: AIGenerationStatus = AIGenerationStatus.IDLE;
  
  /**
   * Get current enhancement status
   */
  getStatus(): AIGenerationStatus {
    return this.status;
  }

  /**
   * Enhance an image using AI
   */
  async enhanceImage(request: ImageEnhancementRequest): Promise<AIResponse<ImageEnhancementResult>> {
    try {
      this.status = AIGenerationStatus.GENERATING;
      
      const provider = request.provider || AIProvider.STABILITY;
      const apiKey = request.apiKey || imageGenerationService.getApiKey?.(provider);
      
      if (!apiKey && provider !== AIProvider.MOCK) {
        throw new Error(`No API key provided for ${provider}`);
      }
      
      const startTime = Date.now();
      
      // Mock implementation for image enhancement
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const enhancementType = request.enhancementType;
      let width = 1024;
      let height = 1024;
      
      // For upscaling, adjust dimensions based on scale
      if (enhancementType === 'upscale' && request.scale) {
        width = Math.round(width * request.scale);
        height = Math.round(height * request.scale);
      }
      
      const result: ImageEnhancementResult = {
        enhancedImageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        width,
        height,
        enhancementType
      };
      
      const processingTime = Date.now() - startTime;
      
      this.status = AIGenerationStatus.SUCCESS;
      
      return {
        success: true,
        data: result,
        processingTime,
        provider
      };
    } catch (error) {
      this.status = AIGenerationStatus.ERROR;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: request.provider
      };
    }
  }

  /**
   * Enhance content metadata (title, description, tags)
   */
  async enhanceMetadata(content: {
    id: string;
    title?: string;
    description?: string;
    tags?: string[];
    mediaType?: string;
    thumbnailUrl?: string;
    duration?: number;
  }): Promise<{
    title?: string;
    description?: string;
    tags?: string[];
  }> {
    const result: {
      title?: string;
      description?: string;
      tags?: string[];
    } = {};
    
    // Combine existing information for context
    const context = [
      content.title ? `Title: ${content.title}` : '',
      content.description ? `Description: ${content.description}` : '',
      content.tags?.length ? `Tags: ${content.tags.join(', ')}` : '',
      content.mediaType ? `Media Type: ${content.mediaType}` : '',
      content.duration ? `Duration: ${content.duration}s` : ''
    ].filter(Boolean).join('\n');
    
    try {
      // Generate improved title if needed
      if (!content.title || content.title.length < 10) {
        const titlePrompt = `Create an engaging, concise title for digital signage content. ${context}`;
        result.title = await textGenerationService.generateTitle(titlePrompt);
      }
      
      // Generate improved description if needed
      if (!content.description || content.description.length < 50) {
        const descPrompt = `Write a compelling description for digital signage content that attracts viewers. ${context}`;
        result.description = await textGenerationService.generateDescription(descPrompt);
      }
      
      // Generate or enhance tags if needed
      if (!content.tags || content.tags.length < 3) {
        const tagsPrompt = `Generate relevant tags for digital signage content. ${context}`;
        result.tags = await textGenerationService.generateTags(tagsPrompt);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to enhance content metadata:', error);
      return result;
    }
  }

  /**
   * Generate a performance score for content
   */
  async generatePerformanceScore(contentId: string, metrics: {
    views?: number;
    averageViewTime?: number;
    engagementRate?: number;
    conversionRate?: number;
    targetAudience?: string;
    displayLocation?: string;
  }): Promise<ContentPerformanceScore> {
    // Calculate scores based on metrics
    const viewScore = metrics.views ? Math.min(100, metrics.views / 10) : 0;
    const engagementScore = metrics.engagementRate ? metrics.engagementRate * 100 : 0;
    const viewTimeScore = metrics.averageViewTime ? Math.min(100, metrics.averageViewTime / 10 * 100) : 0;
    const relevanceScore = metrics.conversionRate ? metrics.conversionRate * 100 : 0;
    
    // Generate overall score (weighted average)
    const overallScore = Math.round(
      (viewScore * 0.2) +
      (engagementScore * 0.3) +
      (viewTimeScore * 0.3) +
      (relevanceScore * 0.2)
    );
    
    // Generate recommendations based on scores
    const recommendations: string[] = [];
    
    if (engagementScore < 50) {
      recommendations.push('Consider adding more interactive elements to increase engagement.');
    }
    
    if (viewTimeScore < 40) {
      recommendations.push('Content may be too long or not capturing attention. Try shorter, more impactful messaging.');
    }
    
    if (relevanceScore < 60) {
      recommendations.push('Content might not be relevant to the target audience. Review targeting parameters.');
    }
    
    return {
      contentId,
      overallScore,
      metrics: {
        engagement: engagementScore,
        viewTime: viewTimeScore,
        relevance: relevanceScore
      },
      recommendations,
      timestamp: new Date()
    };
  }

  /**
   * Optimize content for specific display requirements
   */
  async optimizeForDisplay(content: {
    id: string;
    width: number;
    height: number;
    fileUrl: string;
    mediaType: string;
  }, displayRequirements: {
    maxWidth: number;
    maxHeight: number;
    supportedFormats: string[];
    maxFileSize?: number;
  }): Promise<{
    success: boolean;
    optimizedUrl?: string;
    format?: string;
    width?: number;
    height?: number;
    message?: string;
  }> {
    // Check if content needs optimization
    const needsResize = content.width > displayRequirements.maxWidth || content.height > displayRequirements.maxHeight;
    const formatSupported = displayRequirements.supportedFormats.some(format => 
      content.mediaType.toLowerCase().includes(format.toLowerCase())
    );
    
    if (!needsResize && formatSupported) {
      return {
        success: true,
        message: 'Content already optimized for display',
        optimizedUrl: content.fileUrl,
        format: content.mediaType,
        width: content.width,
        height: content.height
      };
    }
    
    // Mock implementation for optimization
    // In a real implementation, this would call image processing services
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Calculate new dimensions while maintaining aspect ratio
    let newWidth = content.width;
    let newHeight = content.height;
    
    if (needsResize) {
      const aspectRatio = content.width / content.height;
      
      if (content.width > displayRequirements.maxWidth) {
        newWidth = displayRequirements.maxWidth;
        newHeight = Math.round(newWidth / aspectRatio);
      }
      
      if (newHeight > displayRequirements.maxHeight) {
        newHeight = displayRequirements.maxHeight;
        newWidth = Math.round(newHeight * aspectRatio);
      }
    }
    
    // Determine best format
    const targetFormat = formatSupported 
      ? content.mediaType 
      : displayRequirements.supportedFormats[0];
    
    return {
      success: true,
      optimizedUrl: content.fileUrl.replace(/\.[^.]+$/, `.${targetFormat.split('/')[1]}`),
      format: targetFormat,
      width: newWidth,
      height: newHeight,
      message: 'Content optimized successfully'
    };
  }
}

// Export singleton instance
export const contentEnhancementService = new ContentEnhancementService();

// Export functions for direct usage
export const enhanceImage = (request: ImageEnhancementRequest): Promise<AIResponse<ImageEnhancementResult>> => {
  return contentEnhancementService.enhanceImage(request);
};

export const enhanceMetadata = (content: any): Promise<any> => {
  return contentEnhancementService.enhanceMetadata(content);
};

export const generatePerformanceScore = (contentId: string, metrics: any): Promise<ContentPerformanceScore> => {
  return contentEnhancementService.generatePerformanceScore(contentId, metrics);
}; 