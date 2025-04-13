/**
 * Auth utility functions for token management
 */

const TOKEN_KEY = 'vizora_auth_token';
const USER_KEY = 'vizora_user';

/**
 * Get the authentication token from local storage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Set the authentication token in local storage
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Remove the authentication token from local storage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Check if a user is authenticated based on token presence
 */
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  return !!token;
};

/**
 * Get the current user information from local storage
 */
export const getCurrentUser = (): any => {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Error parsing user data from localStorage', error);
    return null;
  }
};

/**
 * Set the current user information in local storage
 */
export const setCurrentUser = (user: any): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Remove the current user information from local storage
 */
export const removeCurrentUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

/**
 * Check if the auth token is expired
 */
export const isTokenExpired = (): boolean => {
  const token = getAuthToken();
  if (!token) return true;
  
  try {
    // JWT tokens consist of three parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    // The second part contains the payload, which needs to be decoded
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if the token has an expiration claim
    if (!payload.exp) return false;
    
    // Convert expiration time from seconds to milliseconds and compare with current time
    const expTime = payload.exp * 1000;
    const currentTime = Date.now();
    
    return currentTime >= expTime;
  } catch (error) {
    console.error('Error checking token expiration', error);
    return true;
  }
};

/**
 * Clear all authentication data
 */
export const clearAuth = (): void => {
  removeAuthToken();
  removeCurrentUser();
  // Additional cleanup if needed
};

/**
 * Check user permission
 */
export const hasPermission = (requiredPermission: string): boolean => {
  const user = getCurrentUser();
  if (!user || !user.permissions) return false;
  
  return user.permissions.includes(requiredPermission);
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (requiredPermissions: string[]): boolean => {
  const user = getCurrentUser();
  if (!user || !user.permissions) return false;
  
  return requiredPermissions.some(permission => user.permissions.includes(permission));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (requiredPermissions: string[]): boolean => {
  const user = getCurrentUser();
  if (!user || !user.permissions) return false;
  
  return requiredPermissions.every(permission => user.permissions.includes(permission));
}; 