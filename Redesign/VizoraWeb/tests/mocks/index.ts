// Export all mock services from a single file for easier imports

export * from './contentServiceMock';
export * from './displayServiceMock';
export * from './organizationServiceMock';
export * from './uploadServiceMock';
export * from './configServiceMock';

// Function to reset all mocks
import { resetContentServiceMocks } from './contentServiceMock';
import { resetDisplayServiceMocks } from './displayServiceMock';
import { resetOrganizationServiceMocks } from './organizationServiceMock';
import { resetUploadServiceMocks } from './uploadServiceMock';
import { resetConfigServiceMocks } from './configServiceMock';

export function resetAllMocks() {
  resetContentServiceMocks();
  resetDisplayServiceMocks();
  resetOrganizationServiceMocks();
  resetUploadServiceMocks();
  resetConfigServiceMocks();
} 