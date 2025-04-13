import { apiClient } from './apiClient';

// Export Content interface to ensure consistent type usage across application
export interface Content {
  id: string;
  title: string;
  description?: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'html' | 'url' | 'text' | 'webpage' | 'stream' | 'playlist';
  url?: string;
  thumbnail?: string;
  status: 'active' | 'inactive' | 'processing';
  tags?: string[];
  folder?: string | null;
  createdAt: string;
  updatedAt: string;
  size?: number;
  duration?: number | null;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
}

export interface ContentMetadata {
  title?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'processing';
  tags?: string[] | string;
  category?: string;
  folder?: string | null;
}

export interface UploadProgress {
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  message?: string;
}

/**
 * In-memory cache for content
 */
const contentCache: Map<string, Content> = new Map();

// Cache management variables
let lastCacheUpdate: number | null = null;
let contentList: Content[] = [];

/**
 * Uploads a file to the server
 * @param file The file to upload
 * @param metadata Optional metadata for the file
 * @param onProgress Optional callback for progress updates
 * @returns The uploaded content data
 */
export const uploadContentFile = async (
  file: File,
  metadata: ContentMetadata = {},
  onProgress?: (data: UploadProgress) => void
): Promise<any> => {
  try {
    // Initialize progress
    if (onProgress) {
      onProgress({
        progress: 0,
        status: 'pending',
        message: 'Preparing upload...'
      });
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    // Append metadata
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.category) formData.append('category', metadata.category);
    if (metadata.folder) formData.append('folder', metadata.folder);
    
    // Handle tags which can be string or array
    if (metadata.tags) {
      if (Array.isArray(metadata.tags)) {
        formData.append('tags', metadata.tags.join(','));
      } else {
        formData.append('tags', metadata.tags);
      }
    }

    // Report upload starting
    if (onProgress) {
      onProgress({
        progress: 10,
        status: 'uploading',
        message: 'Uploading file...'
      });
    }

    console.log('Uploading file using shared contentService');
    
    // Upload the file via post request - Note there's no /api prefix here
    // because apiClient already includes the base URL with /api
    const response = await apiClient.post('/content/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 90) / progressEvent.total);
          onProgress({
            progress: percentCompleted,
            status: 'uploading',
            message: `Uploading: ${percentCompleted}%`
          });
        }
      }
    });

    // Report completion
    if (onProgress) {
      onProgress({
        progress: 100,
        status: 'complete',
        message: 'Upload complete'
      });
    }

    return response;
  } catch (error) {
    console.error('Error uploading content file:', error);
    
    if (onProgress) {
      onProgress({
        progress: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      });
    }
    
    throw error;
  }
};

/**
 * Upload multiple content files
 */
export const uploadMultipleFiles = async (
  files: File[],
  metadata: ContentMetadata = {},
  onProgress?: (data: UploadProgress) => void
): Promise<any> => {
  try {
    if (files.length === 0) {
      throw new Error('No files provided for upload');
    }

    // Initialize progress
    if (onProgress) {
      onProgress({
        progress: 0,
        status: 'pending',
        message: 'Preparing upload...'
      });
    }

    // Create form data
    const formData = new FormData();
    
    // Append each file
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    // Append metadata
    if (metadata.title) formData.append('titlePrefix', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.category) formData.append('category', metadata.category);
    if (metadata.folder) formData.append('folder', metadata.folder);
    
    // Handle tags which can be string or array
    if (metadata.tags) {
      if (Array.isArray(metadata.tags)) {
        formData.append('tags', metadata.tags.join(','));
      } else {
        formData.append('tags', metadata.tags);
      }
    }

    // Report upload starting
    if (onProgress) {
      onProgress({
        progress: 10,
        status: 'uploading',
        message: `Uploading ${files.length} files...`
      });
    }

    console.log(`Uploading ${files.length} files using shared contentService`);
    
    // Upload the files - Note there's no /api prefix here because apiClient already includes the base URL
    const response = await apiClient.post('/content/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 90) / progressEvent.total);
          onProgress({
            progress: percentCompleted,
            status: 'uploading',
            message: `Uploading: ${percentCompleted}%`
          });
        }
      }
    });

    // Report completion
    if (onProgress) {
      onProgress({
        progress: 100,
        status: 'complete',
        message: 'Upload complete'
      });
    }

    return response;
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    
    if (onProgress) {
      onProgress({
        progress: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      });
    }
    
    throw error;
  }
};

/**
 * Gets cached content items
 * @returns Array of cached content or empty array if no cache is available
 */
export const getCachedContent = async (): Promise<any[]> => {
  try {
    console.log('[ContentLibrary] Checking content cache');
    
    // Return the cached content list if it exists
    if (contentList.length > 0) {
      console.log(`[ContentLibrary] Cache check complete: ${contentList.length} items found`);
      return contentList;
    }
    
    // Try to load from localStorage as a fallback
    try {
      const cachedContent = localStorage.getItem('content_cache');
      if (cachedContent) {
        const parsed = JSON.parse(cachedContent);
        if (Array.isArray(parsed)) {
          contentList = parsed;
          console.log(`[ContentLibrary] Cache check complete: ${contentList.length} items found`);
          return contentList;
        }
      }
    } catch (storageError) {
      console.error('[ContentLibrary] Failed to load cache from storage:', storageError);
    }
    
    // Return empty array if no cache is available
    console.log('[ContentLibrary] Cache check complete: 0 items found');
    return [];
  } catch (error) {
    console.error('[ContentLibrary] Failed to load cache:', error);
    return [];
  }
};

/**
 * Caches content items for offline use
 * @param contentItems Content items to cache
 */
export const cacheContent = async (contentItems: any[]): Promise<void> => {
  try {
    if (!contentItems || !Array.isArray(contentItems)) {
      return;
    }
    
    // Update in-memory cache
    contentList = contentItems;
    lastCacheUpdate = Date.now();
    
    // Cache individual items
    contentItems.forEach(item => {
      if (item && item.id) {
        contentCache.set(item.id, item);
      }
    });
    
    // Persist to localStorage as fallback
    try {
      localStorage.setItem('content_cache', JSON.stringify(contentItems));
      localStorage.setItem('lastCacheUpdate', lastCacheUpdate.toString());
    } catch (storageError) {
      console.warn('Unable to persist content cache to localStorage:', storageError);
    }
  } catch (error) {
    console.error('Failed to cache content:', error);
  }
};

/**
 * Clears the content cache
 */
export const clearContentCache = async (): Promise<void> => {
  try {
    contentCache.clear();
    contentList = [];
    lastCacheUpdate = null;
    
    // Clear localStorage cache
    localStorage.removeItem('content_cache');
    localStorage.removeItem('lastCacheUpdate');
  } catch (error) {
    console.error('Failed to clear content cache:', error);
    throw error;
  }
};

/**
 * Refreshes the content cache with the latest data
 * @returns The refreshed content list
 */
export const refreshContentCache = async (): Promise<any[]> => {
  try {
    // Fetch latest content data
    const responseData = await apiClient.get<any>('/content?limit=100');
    
    // Check if responseData is an object and has a 'content' array property
    if (responseData && typeof responseData === 'object' && Array.isArray(responseData.content)) {
      await cacheContent(responseData.content);
      return responseData.content;
    }
    
    console.warn('[contentService] Invalid response structure received from /content endpoint', responseData);
    return [];
  } catch (error) {
    console.error('Failed to refresh content cache:', error);
    throw error;
  }
};

// TODO: Add fetchContentItems to @vizora/common
// TODO: Add createContentMetadata to @vizora/common

// Export as a single object
export const contentService = {
  uploadContentFile,
  uploadMultipleFiles,
  getCachedContent,
  cacheContent,
  clearContentCache,
  refreshContentCache
}; 