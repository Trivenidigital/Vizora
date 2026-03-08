// Support API methods

import type {
  SupportRequest, SupportMessage, SupportContext,
  SupportStats, SupportRequestResponse, SupportQueryParams,
  PaginatedResponse,
} from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    createSupportRequest(data: { message: string; context?: SupportContext }): Promise<SupportRequestResponse>;
    getSupportRequests(params?: SupportQueryParams): Promise<PaginatedResponse<SupportRequest>>;
    getSupportRequest(id: string): Promise<SupportRequest>;
    updateSupportRequest(id: string, data: { status?: string; priority?: string; resolutionNotes?: string }): Promise<SupportRequest>;
    addSupportMessage(requestId: string, content: string): Promise<SupportMessage>;
    getSupportStats(): Promise<SupportStats>;
  }
}

ApiClient.prototype.createSupportRequest = async function (data: { message: string; context?: SupportContext }): Promise<SupportRequestResponse> {
  return this.request<SupportRequestResponse>('/support/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.getSupportRequests = async function (params?: SupportQueryParams): Promise<PaginatedResponse<SupportRequest>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  const query = searchParams.toString();
  return this.request<PaginatedResponse<SupportRequest>>(`/support/requests${query ? `?${query}` : ''}`);
};

ApiClient.prototype.getSupportRequest = async function (id: string): Promise<SupportRequest> {
  return this.request<SupportRequest>(`/support/requests/${id}`);
};

ApiClient.prototype.updateSupportRequest = async function (id: string, data: { status?: string; priority?: string; resolutionNotes?: string }): Promise<SupportRequest> {
  return this.request<SupportRequest>(`/support/requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.addSupportMessage = async function (requestId: string, content: string): Promise<SupportMessage> {
  return this.request<SupportMessage>(`/support/requests/${requestId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
};

ApiClient.prototype.getSupportStats = async function (): Promise<SupportStats> {
  return this.request<SupportStats>('/support/stats');
};
