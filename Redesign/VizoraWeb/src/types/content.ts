import { Content } from '@vizora/common';

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  contentCount: number;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ContentResponse {
  content: Content[];
  pagination: PaginationData;
}

export interface ApiError extends Error {
  statusCode?: number;
  response?: any;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  contentCount: number;
}

export interface BulkUploadResult {
  success: boolean;
  message: string;
  results: {
    success: boolean;
    content?: Content;
    error?: string;
    filename?: string;
  }[];
  errors?: { filename: string; error: string }[];
}

export interface SchedulePayload {
  startTime?: string;
  endTime?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
} 