import { 
  AIProvider, 
  ImageGenerationRequest, 
  AIResponse, 
  ImageGenerationResult,
  AIGenerationStatus
} from './types';

/**
 * Image generation service for AI-powered image creation
 */
class ImageGenerationService {
  private apiKeys: Record<AIProvider, string | undefined> = {
    [AIProvider.OPENAI]: undefined,
    [AIProvider.STABILITY]: undefined,
    [AIProvider.INTERNAL]: undefined,
    [AIProvider.MOCK]: 'mock-key'
  };
  
  private status: AIGenerationStatus = AIGenerationStatus.IDLE;
  private defaultProvider: AIProvider = AIProvider.STABILITY;
  private defaultWidth = 1024;
  private defaultHeight = 1024;
  private placeholderImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  /**
   * Set API keys for different providers
   */
  setApiKey(provider: AIProvider, key: string): void {
    this.apiKeys[provider] = key;
  }

  /**
   * Get API key for specified provider
   */
  getApiKey(provider: AIProvider): string | undefined {
    return this.apiKeys[provider];
  }

  /**
   * Set the default provider to use when none is specified
   */
  setDefaultProvider(provider: AIProvider): void {
    this.defaultProvider = provider;
  }

  /**
   * Get current generation status
   */
  getStatus(): AIGenerationStatus {
    return this.status;
  }

  /**
   * Generate images using AI
   */
  async generateImages(request: ImageGenerationRequest): Promise<AIResponse<ImageGenerationResult>> {
    try {
      this.status = AIGenerationStatus.GENERATING;
      
      const provider = request.provider || this.defaultProvider;
      const apiKey = request.apiKey || this.apiKeys[provider];
      
      if (!apiKey && provider !== AIProvider.MOCK) {
        throw new Error(`No API key provided for ${provider}`);
      }
      
      const startTime = Date.now();
      
      // Use the appropriate provider to generate images
      let result: ImageGenerationResult;
      
      switch (provider) {
        case AIProvider.STABILITY:
          result = await this.generateWithStability(request, apiKey!);
          break;
        case AIProvider.OPENAI:
          result = await this.generateWithOpenAI(request, apiKey!);
          break;
        case AIProvider.INTERNAL:
          result = await this.generateWithInternal(request, apiKey);
          break;
        case AIProvider.MOCK:
          result = this.generateWithMock(request);
          break;
        default:
          throw new Error(`Provider ${provider} not supported for image generation`);
      }
      
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
        provider: request.provider || this.defaultProvider
      };
    }
  }

  /**
   * Generate images using Stability AI
   */
  private async generateWithStability(
    request: ImageGenerationRequest, 
    apiKey: string
  ): Promise<ImageGenerationResult> {
    try {
      // Simulated API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, we would use the apiKey here for authorization
      console.log(`Using Stability AI key: ${apiKey.substring(0, 4)}...`);
      
      const width = request.width || this.defaultWidth;
      const height = request.height || this.defaultHeight;
      const prompt = request.prompt;
      const numberOfImages = request.numberOfImages || 1;
      
      const images = Array(numberOfImages).fill(null).map((_, index) => ({
        base64Data: this.placeholderImageBase64,
        width,
        height,
        seed: 1000 + index
      }));
      
      return {
        images,
        prompt,
        metadata: {
          engine: 'stable-diffusion-xl',
          style: request.style || 'photographic'
        }
      };
    } catch (error) {
      throw new Error(`Stability AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate images using OpenAI
   */
  private async generateWithOpenAI(
    request: ImageGenerationRequest, 
    apiKey: string
  ): Promise<ImageGenerationResult> {
    try {
      // Simulated API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, we would use the apiKey here for authorization
      console.log(`Using OpenAI key: ${apiKey.substring(0, 4)}...`);
      
      const width = request.width || this.defaultWidth;
      const height = request.height || this.defaultHeight;
      const prompt = request.prompt;
      const numberOfImages = request.numberOfImages || 1;
      
      const images = Array(numberOfImages).fill(null).map(() => ({
        base64Data: this.placeholderImageBase64,
        width,
        height
      }));
      
      return {
        images,
        prompt,
        metadata: {
          model: 'dall-e-3',
          style: request.style || 'vivid'
        }
      };
    } catch (error) {
      throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate images using internal API
   */
  private async generateWithInternal(
    request: ImageGenerationRequest, 
    apiKey?: string
  ): Promise<ImageGenerationResult> {
    try {
      // Simulated API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real implementation, we would use the apiKey here for authorization
      if (apiKey) {
        console.log(`Using Internal API key: ${apiKey.substring(0, 4)}...`);
      }
      
      const width = request.width || this.defaultWidth;
      const height = request.height || this.defaultHeight;
      const prompt = request.prompt;
      const numberOfImages = request.numberOfImages || 1;
      
      const images = Array(numberOfImages).fill(null).map(() => ({
        base64Data: this.placeholderImageBase64,
        width,
        height
      }));
      
      return {
        images,
        prompt,
        metadata: {
          model: 'internal-diffusion-v1',
          style: request.style || 'standard'
        }
      };
    } catch (error) {
      throw new Error(`Internal generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate images using mock responses (for development/testing)
   */
  private generateWithMock(request: ImageGenerationRequest): ImageGenerationResult {
    const width = request.width || this.defaultWidth;
    const height = request.height || this.defaultHeight;
    const prompt = request.prompt;
    const numberOfImages = request.numberOfImages || 1;
    
    const images = Array(numberOfImages).fill(null).map((_, index) => ({
      base64Data: this.placeholderImageBase64,
      width,
      height,
      seed: 500 + index
    }));
    
    return {
      images,
      prompt,
      metadata: {
        model: 'mock-model',
        style: request.style || 'default'
      }
    };
  }

  /**
   * Generate a single image - convenience method
   */
  async generateImage(prompt: string, width?: number, height?: number, provider?: AIProvider): Promise<string> {
    const response = await this.generateImages({
      prompt,
      width,
      height,
      numberOfImages: 1,
      provider
    });
    
    if (!response.success || !response.data || !response.data.images[0]) {
      throw new Error(response.error || 'Failed to generate image');
    }
    
    return response.data.images[0].base64Data || '';
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();

// Export functions for direct usage
export const generateImages = (request: ImageGenerationRequest): Promise<AIResponse<ImageGenerationResult>> => {
  return imageGenerationService.generateImages(request);
};

export const generateImage = (prompt: string, width?: number, height?: number, provider?: AIProvider): Promise<string> => {
  return imageGenerationService.generateImage(prompt, width, height, provider);
}; 