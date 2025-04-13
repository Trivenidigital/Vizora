import { Content } from '@vizora/common';
import { TokenManager } from '@vizora/common';

// Helper function to construct proper API URLs without duplicate /api segments
export const constructApiUrl = (endpoint: string): string => {
  // Remove trailing slash and any /api suffix from the base URL
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3003').replace(/\/api\/?$/, '');
  
  // Ensure endpoint starts with a slash and doesn't start with /api
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;
  
  const finalEndpoint = normalizedEndpoint.startsWith('/api/')
    ? normalizedEndpoint.substring(4) // Remove the /api prefix
    : normalizedEndpoint;
    
  return `${baseUrl}${finalEndpoint}`;
};

// Helper function to get standard fetch headers with authentication
export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  const token = TokenManager.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Format file size to human-readable format
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get content type icon name
export const getContentTypeIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    'image': 'photo',
    'video': 'film',
    'document': 'document',
    'webpage': 'globe',
    'default': 'document'
  };
  return iconMap[type] || iconMap.default;
};

// Format content metadata for display
export const formatContentMetadata = (content: Content): Record<string, string> => {
  return {
    type: content.type.charAt(0).toUpperCase() + content.type.slice(1),
    size: formatFileSize(content.size || 0),
    created: new Date(content.createdAt).toLocaleDateString(),
    modified: new Date(content.updatedAt).toLocaleDateString(),
    ...(content.metadata || {})
  };
};

// Generate thumbnail URL with fallback
export const getThumbnailUrl = (content: Content): string => {
  if (content.thumbnail) {
    return content.thumbnail;
  }
  
  // Default thumbnails based on content type
  const defaultThumbnails: Record<string, string> = {
    'image': '/assets/thumbnails/image-placeholder.png',
    'video': '/assets/thumbnails/video-placeholder.png',
    'document': '/assets/thumbnails/document-placeholder.png',
    'webpage': '/assets/thumbnails/webpage-placeholder.png'
  };
  
  return defaultThumbnails[content.type] || defaultThumbnails.document;
};

// Cache-related types
export interface CacheStatus {
  isLoading: boolean;
  size: number;
  lastUpdated: Date | null;
  itemCount: number;
  error: string | null;
}

export interface CacheOptions {
  maxAge?: number;
  maxItems?: number;
  maxSize?: number;
} 