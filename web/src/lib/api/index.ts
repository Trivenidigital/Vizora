// Barrel file — re-exports everything for backwards compatibility
// Import domain modules to register prototype extensions on ApiClient
import './auth';
import './content';
import './displays';
import './playlists';
import './schedules';
import './organizations';
import './analytics';
import './users';
import './notifications';
import './billing';
import './admin';
import './templates';
import './widgets';
import './support';
import './fleet';

// Re-export client class, types, and singleton
import { ApiClient, API_BASE_URL, getCsrfToken } from './client';
export { ApiClient, API_BASE_URL, getCsrfToken };
export type { AuthUser, Organization, LoginResponse, RegisterResponse, ScheduleData } from './client';

// Create and export the singleton instance
export const apiClient = new ApiClient(API_BASE_URL);
