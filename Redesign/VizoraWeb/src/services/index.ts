/**
 * Services index file
 * Exports all services from a central location for easy imports
 */

// Authentication services
export { default as authService } from './authService';

// Content services
export { contentService, type Content, type ContentMetadata, type UploadProgress } from './contentService';

// Organization services
export { folderService, type Folder } from './folderService';

// Display services
export { default as displayService } from './displayService';

// Socket services
export { default as socketService } from './socketService';

// API services
export { default as apiService } from './apiService';

// Schedule services
export { default as scheduleService } from './scheduleService';

// User services
export { default as userService } from './userService';

// Analytics services
export { default as analyticsService } from './analyticsService';

// Notification services
export { default as notificationService } from './notificationService';

// Storage services 
export { indexedDBStorage, cachingService } from './storage';
export type { CacheStatus, CachingOptions } from './storage'; 