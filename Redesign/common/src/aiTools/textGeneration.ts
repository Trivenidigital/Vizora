import { 
  AIProvider, 
  TextGenerationRequest, 
  AIResponse, 
  TextGenerationResult,
  AIGenerationStatus
} from './types';

/**
 * Text generation service for AI-powered content creation
 */
class TextGenerationService {
  private apiKeys: Record<AIProvider, string | undefined> = {
    [AIProvider.OPENAI]: undefined,
    [AIProvider.STABILITY]: undefined,
    [AIProvider.INTERNAL]: undefined,
    [AIProvider.MOCK]: 'mock-key'
  };
  
  private status: AIGenerationStatus = AIGenerationStatus.IDLE;
  private defaultProvider: AIProvider = AIProvider.OPENAI;
  private mockResponses: Record<string, string> = {
    title: 'AI-Generated Engaging Title',
    description: 'This is an AI-generated description that highlights the key features and benefits of this content.',
    tags: 'ai,generated,content,vizora,digital signage',
    creative: 'Once upon a time in the digital realm, innovative content transformed ordinary displays into extraordinary experiences.',
    analytical: 'Analysis indicates that interactive content increases engagement by 57% compared to static content.'
  };

  /**
   * Set API keys for different providers
   */
  setApiKey(provider: AIProvider, key: string): void {
    this.apiKeys[provider] = key;
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
   * Generate text using AI
   */
  async generateText(request: TextGenerationRequest): Promise<AIResponse<TextGenerationResult>> {
    try {
      this.status = AIGenerationStatus.GENERATING;
      
      const provider = request.provider || this.defaultProvider;
      const apiKey = request.apiKey || this.apiKeys[provider];
      
      if (!apiKey && provider !== AIProvider.MOCK) {
        throw new Error(`No API key provided for ${provider}`);
      }
      
      const startTime = Date.now();
      
      // Use the appropriate provider to generate text
      let result: TextGenerationResult;
      
      switch (provider) {
        case AIProvider.OPENAI:
          result = await this.generateWithOpenAI(request, apiKey!);
          break;
        case AIProvider.INTERNAL:
          result = await this.generateWithInternal(request);
          break;
        case AIProvider.MOCK:
          result = this.generateWithMock(request, apiKey || 'mock-key');
          break;
        default:
          throw new Error(`Provider ${provider} not supported for text generation`);
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
   * Generate text using OpenAI
   */
  private async generateWithOpenAI(
    request: TextGenerationRequest, 
    apiKey: string
  ): Promise<TextGenerationResult> {
    try {
      // In a real implementation, we would use the apiKey for authorization
      console.log(`Using OpenAI key: ${apiKey.substring(0, 4)}...`);
      
      // Simulated API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const type = request.type || 'creative';
      const temperature = request.temperature || 0.7;
      const prompt = request.prompt;
      
      // This would be a real API call in production
      const response = {
        text: `OpenAI generated text based on: "${prompt}" with ${temperature} temperature as ${type} content.`,
        type,
        alternatives: [
          `Alternative 1 for: "${prompt}"`,
          `Alternative 2 for: "${prompt}"`
        ]
      };
      
      return response;
    } catch (error) {
      throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate text using internal API
   */
  private async generateWithInternal(
    request: TextGenerationRequest
  ): Promise<TextGenerationResult> {
    // This would be replaced with actual internal API call
    // For now, we'll just return a placeholder implementation
    
    try {
      // Simulated API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const type = request.type || 'creative';
      const prompt = request.prompt;
      
      // This would be a real API call in production
      const response = {
        text: `Internal AI generated text based on: "${prompt}" as ${type} content.`,
        type,
        alternatives: [
          `Internal alternative 1 for: "${prompt}"`,
        ]
      };
      
      return response;
    } catch (error) {
      throw new Error(`Internal generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate text with a mock generator (for testing)
   */
  private generateWithMock(
    request: TextGenerationRequest,
    apiKey?: string
  ): TextGenerationResult {
    // In a real implementation, this would use the apiKey
    if (apiKey) {
      console.log(`Using Mock key: ${apiKey.substring(0, 4)}...`);
    }
    
    const type = request.type || 'creative';
    const prompt = request.prompt.toLowerCase();
    
    // Get mock response based on type
    let responseText = '';
    
    // Use the mockResponses object to get the appropriate response
    if (this.mockResponses[type]) {
      responseText = this.mockResponses[type];
    } else {
      responseText = this.mockResponses['creative'];
    }
    
    // Append some words from the prompt to make it feel responsive
    const promptWords = prompt.split(' ').filter(word => word.length > 4);
    if (promptWords.length > 2) {
      const randomWord = promptWords[Math.floor(Math.random() * promptWords.length)];
      responseText += ` The concept of "${randomWord}" is particularly relevant here.`;
    }
    
    return {
      text: responseText,
      type,
      alternatives: [
        `Mock alternative 1 for: "${request.prompt}"`,
        `Mock alternative 2 for: "${request.prompt}"`
      ]
    };
  }

  /**
   * Generate content title
   */
  async generateTitle(prompt: string, provider?: AIProvider): Promise<string> {
    const response = await this.generateText({
      prompt,
      type: 'title',
      provider
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate title');
    }
    
    return response.data.text;
  }

  /**
   * Generate content description
   */
  async generateDescription(prompt: string, provider?: AIProvider): Promise<string> {
    const response = await this.generateText({
      prompt,
      type: 'description',
      provider
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate description');
    }
    
    return response.data.text;
  }

  /**
   * Generate tags for content
   */
  async generateTags(prompt: string, provider?: AIProvider): Promise<string[]> {
    const response = await this.generateText({
      prompt,
      type: 'tags',
      provider
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate tags');
    }
    
    // Convert comma-separated tags to array
    return response.data.text.split(',').map(tag => tag.trim());
  }
}

// Export singleton instance
export const textGenerationService = new TextGenerationService();

// Export functions for direct usage
export const generateText = (request: TextGenerationRequest): Promise<AIResponse<TextGenerationResult>> => {
  return textGenerationService.generateText(request);
};

export const generateTitle = (prompt: string, provider?: AIProvider): Promise<string> => {
  return textGenerationService.generateTitle(prompt, provider);
};

export const generateDescription = (prompt: string, provider?: AIProvider): Promise<string> => {
  return textGenerationService.generateDescription(prompt, provider);
};

export const generateTags = (prompt: string, provider?: AIProvider): Promise<string[]> => {
  return textGenerationService.generateTags(prompt, provider);
}; 