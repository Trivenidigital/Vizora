// Template Library API methods

import type {
  Content, TemplateSearchResult, TemplateCategory,
  TemplateSummary, TemplateDetail, AIGenerateResponse,
} from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    searchTemplates(params?: { search?: string; category?: string; tag?: string; orientation?: string; difficulty?: string; page?: number; limit?: number }): Promise<TemplateSearchResult>;
    getTemplateCategories(): Promise<TemplateCategory[]>;
    getFeaturedTemplates(): Promise<TemplateSummary[]>;
    getSeasonalTemplates(): Promise<TemplateSummary[]>;
    getPopularTemplates(): Promise<TemplateSummary[]>;
    getUserTemplates(params?: { search?: string; page?: number; limit?: number }): Promise<TemplateSearchResult>;
    aiGenerateTemplate(data: { prompt: string; category?: string; orientation?: string; style?: string }): Promise<AIGenerateResponse>;
    getTemplateDetail(id: string): Promise<TemplateDetail>;
    getTemplatePreview(id: string): Promise<{ html: string }>;
    cloneTemplate(id: string, data?: { name?: string; description?: string }): Promise<Content>;
    // Template Admin
    createTemplate(data: { name: string; description?: string; templateHtml: string; category: string; difficulty?: string; orientation?: string; tags?: string[]; sampleData?: Record<string, any>; thumbnailUrl?: string; duration?: number }): Promise<any>;
    updateTemplate(id: string, data: { name?: string; description?: string; templateHtml?: string; category?: string; difficulty?: string; orientation?: string; tags?: string[]; sampleData?: Record<string, any>; thumbnailUrl?: string; duration?: number }): Promise<any>;
    deleteTemplate(id: string): Promise<void>;
    publishTemplate(templateId: string, data: { renderedHtml: string; displayIds: string[]; name: string; duration?: number }): Promise<{ contentId: string; displayCount: number }>;
  }
}

ApiClient.prototype.searchTemplates = async function (params?: {
  search?: string;
  category?: string;
  tag?: string;
  orientation?: string;
  difficulty?: string;
  page?: number;
  limit?: number;
}): Promise<TemplateSearchResult> {
  const query = params ? new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString() : '';
  return this.request<TemplateSearchResult>(`/template-library${query ? `?${query}` : ''}`);
};

ApiClient.prototype.getTemplateCategories = async function (): Promise<TemplateCategory[]> {
  return this.request<TemplateCategory[]>('/template-library/categories');
};

ApiClient.prototype.getFeaturedTemplates = async function (): Promise<TemplateSummary[]> {
  return this.request<TemplateSummary[]>('/template-library/featured');
};

ApiClient.prototype.getSeasonalTemplates = async function (): Promise<TemplateSummary[]> {
  return this.request<TemplateSummary[]>('/template-library/seasonal');
};

ApiClient.prototype.getPopularTemplates = async function (): Promise<TemplateSummary[]> {
  return this.request<TemplateSummary[]>('/template-library/popular');
};

ApiClient.prototype.getUserTemplates = async function (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<TemplateSearchResult> {
  const query = params ? new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString() : '';
  return this.request<TemplateSearchResult>(`/template-library/user-templates${query ? `?${query}` : ''}`);
};

ApiClient.prototype.aiGenerateTemplate = async function (data: {
  prompt: string;
  category?: string;
  orientation?: string;
  style?: string;
}): Promise<AIGenerateResponse> {
  return this.request<AIGenerateResponse>('/template-library/ai-generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.getTemplateDetail = async function (id: string): Promise<TemplateDetail> {
  return this.request<TemplateDetail>(`/template-library/${id}`);
};

ApiClient.prototype.getTemplatePreview = async function (id: string): Promise<{ html: string }> {
  return this.request<{ html: string }>(`/template-library/${id}/preview`);
};

ApiClient.prototype.cloneTemplate = async function (id: string, data?: { name?: string; description?: string }): Promise<Content> {
  return this.request<Content>(`/template-library/${id}/clone`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
};

// Template Admin
ApiClient.prototype.createTemplate = async function (data: {
  name: string;
  description?: string;
  templateHtml: string;
  category: string;
  difficulty?: string;
  orientation?: string;
  tags?: string[];
  sampleData?: Record<string, any>;
  thumbnailUrl?: string;
  duration?: number;
}): Promise<any> {
  return this.request<any>('/template-library', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateTemplate = async function (id: string, data: {
  name?: string;
  description?: string;
  templateHtml?: string;
  category?: string;
  difficulty?: string;
  orientation?: string;
  tags?: string[];
  sampleData?: Record<string, any>;
  thumbnailUrl?: string;
  duration?: number;
}): Promise<any> {
  return this.request<any>(`/template-library/${id}/save`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deleteTemplate = async function (id: string): Promise<void> {
  await this.request<void>(`/template-library/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.publishTemplate = async function (templateId: string, data: {
  renderedHtml: string;
  displayIds: string[];
  name: string;
  duration?: number;
}): Promise<{ contentId: string; displayCount: number }> {
  return this.request<{ contentId: string; displayCount: number }>(`/template-library/${templateId}/publish`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
