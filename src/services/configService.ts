import { DisplayConfig } from '../types/config';

const configService = {
  getConfiguration: async (): Promise<DisplayConfig> => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  },

  updateConfiguration: async (config: DisplayConfig): Promise<void> => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  },

  resetConfiguration: async (): Promise<DisplayConfig> => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  },

  exportConfiguration: async (config: DisplayConfig): Promise<void> => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  },

  importConfiguration: async (config: DisplayConfig): Promise<void> => {
    // Implementation will be mocked in tests
    throw new Error('Not implemented');
  }
};

export default configService; 