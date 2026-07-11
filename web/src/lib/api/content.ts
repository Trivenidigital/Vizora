// Content API methods

import { devLog } from '../logger';
import type { Content, PaginatedResponse, ContentFolder } from '../types';
import { ApiClient, getCsrfToken } from './client';

export interface ContentListParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  templateOrientation?: 'landscape' | 'portrait' | 'both';
  search?: string;
  dateRange?: '7days' | '30days' | '90days';
  tagNames?: string[];
  tagIds?: string[];
}

export interface ContentTagSummary {
  id: string;
  name: string;
  color: string | null;
  contentCount: number;
}

export interface ContentBulkDeleteResult {
  deleted: number;
  failed: number;
  failedIds: string[];
}

export interface ContentReplaceResult {
  content: Content;
  fileHash: string;
}

declare module './client' {
  interface ApiClient {
    getContent(params?: ContentListParams): Promise<PaginatedResponse<Content>>;
    getContentTags(): Promise<ContentTagSummary[]>;
    getContentItem(id: string): Promise<Content>;
    createContent(data: { title: string; type: string; url?: string; file?: File; metadata?: Record<string, unknown> }): Promise<Content>;
    updateContent(id: string, data: Partial<{ title: string; duration: number; metadata?: Record<string, unknown> }>): Promise<Content>;
    deleteContent(id: string): Promise<void>;
    archiveContent(id: string): Promise<Content>;
    // Content expiration (auto-replacement) — PATCH/DELETE /content/:id/expiration
    setContentExpiration(id: string, expiresAt: string, replacementContentId?: string): Promise<Content>;
    clearContentExpiration(id: string): Promise<Content>;
    // File replacement + version history — /content/:id/{replace,versions,restore}
    replaceContentFile(id: string, file: File, options?: { name?: string; keepBackup?: boolean }): Promise<ContentReplaceResult>;
    getContentVersions(id: string): Promise<Content[]>;
    restoreContentVersion(id: string): Promise<Content>;
    // Safe bulk operations — POST /content/bulk/{delete,archive,duration}
    bulkDeleteContent(ids: string[]): Promise<ContentBulkDeleteResult>;
    bulkArchiveContent(ids: string[]): Promise<{ archived: number }>;
    bulkSetContentDuration(ids: string[], duration: number): Promise<{ updated: number }>;
    getContentDownloadUrl(id: string, expirySeconds?: number): Promise<{ url: string; expiresIn: number }>;
    generateThumbnail(contentId: string): Promise<{ thumbnail: string }>;
    uploadContentWithProgress(data: { title: string; type: string; file: File | Blob }, onProgress?: (percent: number) => void): Promise<Content>;
    // Content Moderation
    flagContent(id: string, reason?: string): Promise<Content>;
    reviewContent(id: string, action: 'approve' | 'reject', reason?: string): Promise<Content>;
    // Content Folders
    getFolders(params?: { format?: 'flat' | 'tree' }): Promise<ContentFolder[]>;
    getFolder(id: string): Promise<ContentFolder>;
    createFolder(data: { name: string; parentId?: string }): Promise<ContentFolder>;
    updateFolder(id: string, data: { name?: string; parentId?: string }): Promise<ContentFolder>;
    deleteFolder(id: string): Promise<void>;
    moveContentToFolder(folderId: string, contentIds: string[]): Promise<{ moved: number }>;
    getFolderContent(folderId: string, params?: ContentListParams): Promise<PaginatedResponse<Content>>;
  }
}

const buildContentListQuery = (params?: ContentListParams): string => {
  if (!params) return '';
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      if (value.length > 0) {
        value.forEach((item) => query.append(key, String(item)));
      }
      return;
    }
    query.set(key, String(value));
  });

  return query.toString();
};

ApiClient.prototype.getContent = async function (params?: ContentListParams): Promise<PaginatedResponse<Content>> {
  const query = buildContentListQuery(params);
  return this.request<PaginatedResponse<Content>>(`/content${query ? `?${query}` : ''}`);
};

ApiClient.prototype.getContentTags = async function (): Promise<ContentTagSummary[]> {
  return this.request<ContentTagSummary[]>('/content/tags');
};

ApiClient.prototype.getContentItem = async function (id: string): Promise<Content> {
  return this.request<Content>(`/content/${id}`);
};

ApiClient.prototype.createContent = async function (data: {
  title: string;
  type: string;
  url?: string;
  file?: File;
  metadata?: Record<string, unknown>;
}): Promise<Content> {
  // If file is provided, use multipart upload endpoint
  if (data.file) {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('name', data.title);
    formData.append('type', data.type);

    if (process.env.NODE_ENV === 'development') {
      devLog(`[API] Request: POST ${this.baseUrl}/content/upload (multipart/form-data)`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for uploads

    // Get CSRF token for the upload request
    const csrfToken = getCsrfToken();

    try {
      const response = await fetch(`${this.baseUrl}/content/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include httpOnly cookie
        signal: controller.signal,
        headers: {
          // Don't set Content-Type - browser will set it with boundary for FormData
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      clearTimeout(timeoutId);

      if (process.env.NODE_ENV === 'development') {
        devLog(`[API] Response status: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        // Log the actual error for debugging
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        if (process.env.NODE_ENV === 'development') {
          console.error('[API] Upload error:', response.status, errorData);
        }

        if (response.status === 401 || response.status === 403) {
          // Don't immediately redirect on 403 - could be CSRF issue
          // Only redirect on 401 (truly unauthorized)
          if (response.status === 401) {
            this.isAuthenticated = false;
            if (typeof window !== 'undefined') {
              const currentPath = window.location.pathname;
              window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
            }
          }
        }
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (process.env.NODE_ENV === 'development') {
        devLog('[API] File upload successful');
      }
      // Unwrap response envelope { success, data: { content, fileHash } }
      const unwrapped = (result && typeof result === 'object' && 'success' in result && 'data' in result) ? result.data : result;
      return unwrapped.content || unwrapped;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Upload timeout');
      }
      throw error;
    }
  }

  // Otherwise use JSON endpoint (for URLs)
  const payload = {
    name: data.title,
    type: data.type === 'pdf' ? 'url' : data.type,
    url: data.url || '',
    metadata: data.metadata,
  };
  return this.request<Content>('/content', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

ApiClient.prototype.updateContent = async function (
  id: string,
  data: Partial<{ title: string; metadata?: Record<string, unknown> }>
): Promise<Content> {
  const { title, ...rest } = data;
  const payload = {
    ...rest,
    ...(title !== undefined ? { name: title } : {}),
  };

  return this.request<Content>(`/content/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

ApiClient.prototype.deleteContent = async function (id: string): Promise<void> {
  return this.request<void>(`/content/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.archiveContent = async function (id: string): Promise<Content> {
  return this.request<Content>(`/content/${id}/archive`, {
    method: 'POST',
  });
};

ApiClient.prototype.setContentExpiration = async function (
  id: string,
  expiresAt: string,
  replacementContentId?: string,
): Promise<Content> {
  return this.request<Content>(`/content/${id}/expiration`, {
    method: 'PATCH',
    body: JSON.stringify({
      expiresAt,
      ...(replacementContentId ? { replacementContentId } : {}),
    }),
  });
};

ApiClient.prototype.clearContentExpiration = async function (id: string): Promise<Content> {
  return this.request<Content>(`/content/${id}/expiration`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.replaceContentFile = async function (
  id: string,
  file: File,
  options: { name?: string; keepBackup?: boolean } = {},
): Promise<ContentReplaceResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.name) {
    formData.append('name', options.name);
  }
  if (options.keepBackup !== undefined) {
    formData.append('keepBackup', String(options.keepBackup));
  }
  return this.requestFormData<ContentReplaceResult>(`/content/${id}/replace`, formData, 'POST');
};

ApiClient.prototype.getContentVersions = async function (id: string): Promise<Content[]> {
  return this.request<Content[]>(`/content/${id}/versions`);
};

ApiClient.prototype.restoreContentVersion = async function (id: string): Promise<Content> {
  return this.request<Content>(`/content/${id}/restore`, {
    method: 'POST',
  });
};

ApiClient.prototype.bulkDeleteContent = async function (ids: string[]): Promise<ContentBulkDeleteResult> {
  return this.request<ContentBulkDeleteResult>('/content/bulk/delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
};

ApiClient.prototype.bulkArchiveContent = async function (ids: string[]): Promise<{ archived: number }> {
  return this.request<{ archived: number }>('/content/bulk/archive', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
};

ApiClient.prototype.bulkSetContentDuration = async function (
  ids: string[],
  duration: number,
): Promise<{ updated: number }> {
  return this.request<{ updated: number }>('/content/bulk/duration', {
    method: 'POST',
    body: JSON.stringify({ ids, duration }),
  });
};

ApiClient.prototype.flagContent = async function (id: string, reason?: string): Promise<Content> {
  return this.request<Content>(`/content/${id}/flag`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};

ApiClient.prototype.reviewContent = async function (id: string, action: 'approve' | 'reject', reason?: string): Promise<Content> {
  return this.request<Content>(`/content/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  });
};

ApiClient.prototype.getContentDownloadUrl = async function (id: string, expirySeconds?: number): Promise<{ url: string; expiresIn: number }> {
  const query = expirySeconds ? `?expirySeconds=${expirySeconds}` : '';
  return this.request<{ url: string; expiresIn: number }>(`/content/${id}/download${query}`);
};

ApiClient.prototype.generateThumbnail = async function (contentId: string): Promise<{ thumbnail: string }> {
  return this.request<{ thumbnail: string }>(`/content/${contentId}/thumbnail`, {
    method: 'POST',
  });
};

ApiClient.prototype.uploadContentWithProgress = function (
  this: ApiClient,
  data: { title: string; type: string; file: File | Blob },
  onProgress?: (percent: number) => void,
): Promise<Content> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('name', data.title);
    formData.append('type', data.type);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${this.baseUrl}/content/upload`);
    xhr.withCredentials = true;

    const csrfToken = getCsrfToken();
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          // Unwrap response envelope
          const unwrapped = result?.success !== undefined && result?.data !== undefined
            ? result.data
            : result;
          resolve(unwrapped.content || unwrapped);
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timeout'));
    xhr.timeout = 120000;

    xhr.send(formData);
  });
};

// Content Folders
ApiClient.prototype.getFolders = async function (params?: { format?: 'flat' | 'tree' }): Promise<ContentFolder[]> {
  const query = params?.format ? `?format=${params.format}` : '';
  return this.request<ContentFolder[]>(`/folders${query}`);
};

ApiClient.prototype.getFolder = async function (id: string): Promise<ContentFolder> {
  return this.request<ContentFolder>(`/folders/${id}`);
};

ApiClient.prototype.createFolder = async function (data: { name: string; parentId?: string }): Promise<ContentFolder> {
  return this.request<ContentFolder>('/folders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateFolder = async function (id: string, data: { name?: string; parentId?: string }): Promise<ContentFolder> {
  return this.request<ContentFolder>(`/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deleteFolder = async function (id: string): Promise<void> {
  return this.request<void>(`/folders/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.moveContentToFolder = async function (folderId: string, contentIds: string[]): Promise<{ moved: number }> {
  return this.request<{ moved: number }>(`/folders/${folderId}/content`, {
    method: 'POST',
    body: JSON.stringify({ contentIds }),
  });
};

ApiClient.prototype.getFolderContent = async function (folderId: string, params?: ContentListParams): Promise<PaginatedResponse<Content>> {
  const query = buildContentListQuery(params);
  return this.request<PaginatedResponse<Content>>(`/folders/${folderId}/content${query ? `?${query}` : ''}`);
};
