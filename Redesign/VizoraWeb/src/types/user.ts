export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface UserProfile extends User {
  company?: string;
  position?: string;
  phone?: string;
  bio?: string;
  timezone?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  pushNotifications: boolean;
  displayOfflineAlerts: boolean;
  contentUpdateAlerts: boolean;
} 