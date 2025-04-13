/**
 * Display State Tracking
 * 
 * Central repository for tracking display state across different components
 * Especially useful for tracking display failures to prevent unnecessary API calls
 */

// Key for storing deleted displays in localStorage
const DELETED_DISPLAYS_KEY = 'vizora_deleted_displays';

// Set to track displays that have failed with 404 errors
export const failedDisplays = new Set<string>();

// Initialize from localStorage if possible
try {
  const storedDeletedDisplays = localStorage.getItem(DELETED_DISPLAYS_KEY);
  if (storedDeletedDisplays) {
    const deletedDisplayIds = JSON.parse(storedDeletedDisplays);
    if (Array.isArray(deletedDisplayIds)) {
      deletedDisplayIds.forEach(id => failedDisplays.add(id));
      console.log(`Initialized failedDisplays with ${failedDisplays.size} entries from localStorage`);
    }
  }
} catch (error) {
  console.warn('Error initializing failedDisplays from localStorage:', error);
}

/**
 * Check if a display ID has previously failed with a 404 error
 */
export function hasFailedWith404(displayId: string): boolean {
  return failedDisplays.has(displayId);
}

/**
 * Mark a display as having failed with a 404 error
 */
export function markAsFailed(displayId: string): void {
  if (!displayId) return;
  
  failedDisplays.add(displayId);
  
  // Also update localStorage for persistence across page reloads
  try {
    const storedValue = localStorage.getItem(DELETED_DISPLAYS_KEY);
    let deletedDisplays: string[] = [];
    
    if (storedValue) {
      deletedDisplays = JSON.parse(storedValue);
      if (!Array.isArray(deletedDisplays)) {
        deletedDisplays = [];
      }
    }
    
    if (!deletedDisplays.includes(displayId)) {
      deletedDisplays.push(displayId);
      localStorage.setItem(DELETED_DISPLAYS_KEY, JSON.stringify(deletedDisplays));
      console.log(`Added ${displayId} to deleted displays list in localStorage`);
    }
  } catch (error) {
    console.warn('Error updating deleted displays in localStorage:', error);
  }
} 