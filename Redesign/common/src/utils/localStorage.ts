/**
 * Utility functions for interacting with localStorage safely.
 * These functions handle browser compatibility issues and errors when
 * localStorage is disabled or unavailable.
 */

/**
 * Check if localStorage is available
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Store an item in localStorage
 */
export const setItem = (key: string, value: any): boolean => {
  try {
    if (!isLocalStorageAvailable()) return false;
    
    const serializedValue = typeof value === 'object' 
      ? JSON.stringify(value) 
      : String(value);
    
    localStorage.setItem(key, serializedValue);
    return true;
  } catch (error) {
    console.error('Error storing data in localStorage:', error);
    return false;
  }
};

/**
 * Retrieve an item from localStorage
 */
export const getItem = <T>(key: string, defaultValue: T): T => {
  try {
    if (!isLocalStorageAvailable()) return defaultValue;
    
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    
    try {
      // Attempt to parse as JSON first
      return JSON.parse(value) as T;
    } catch {
      // If parsing fails, return as string or the original value
      return value as unknown as T;
    }
  } catch (error) {
    console.error('Error retrieving data from localStorage:', error);
    return defaultValue;
  }
};

/**
 * Remove an item from localStorage
 */
export const removeItem = (key: string): boolean => {
  try {
    if (!isLocalStorageAvailable()) return false;
    
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing data from localStorage:', error);
    return false;
  }
};

/**
 * Clear all items from localStorage
 */
export const clear = (): boolean => {
  try {
    if (!isLocalStorageAvailable()) return false;
    
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
};

/**
 * Get all keys stored in localStorage
 */
export const getAllKeys = (): string[] => {
  try {
    if (!isLocalStorageAvailable()) return [];
    
    return Object.keys(localStorage);
  } catch (error) {
    console.error('Error getting keys from localStorage:', error);
    return [];
  }
}; 