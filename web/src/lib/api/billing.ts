// Billing API methods

import type {
  ApiKey, CreateApiKeyResponse,
  SubscriptionStatus, Plan, QuotaUsage, Invoice,
  CheckoutResponse, BillingPortalResponse,
} from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    // API Keys
    getApiKeys(): Promise<ApiKey[]>;
    createApiKey(data: { name: string; scopes?: string[]; expiresAt?: string }): Promise<CreateApiKeyResponse>;
    revokeApiKey(id: string): Promise<void>;
    // Billing
    getSubscriptionStatus(): Promise<SubscriptionStatus>;
    getPlans(country?: string): Promise<Plan[]>;
    getQuotaUsage(): Promise<QuotaUsage>;
    createCheckout(planId: string, interval: 'monthly' | 'yearly'): Promise<CheckoutResponse>;
    cancelSubscription(immediately?: boolean): Promise<void>;
    reactivateSubscription(): Promise<void>;
    getBillingPortalUrl(returnUrl: string): Promise<BillingPortalResponse>;
    getInvoices(limit?: number): Promise<Invoice[]>;
  }
}

// API Keys
ApiClient.prototype.getApiKeys = async function (): Promise<ApiKey[]> {
  return this.request<ApiKey[]>('/api-keys');
};

ApiClient.prototype.createApiKey = async function (data: { name: string; scopes?: string[]; expiresAt?: string }): Promise<CreateApiKeyResponse> {
  return this.request<CreateApiKeyResponse>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.revokeApiKey = async function (id: string): Promise<void> {
  await this.request<{ success: boolean }>(`/api-keys/${id}`, {
    method: 'DELETE',
  });
};

// Billing
ApiClient.prototype.getSubscriptionStatus = async function (): Promise<SubscriptionStatus> {
  return this.request<SubscriptionStatus>('/billing/subscription');
};

ApiClient.prototype.getPlans = async function (country?: string): Promise<Plan[]> {
  const params = country ? `?country=${country}` : '';
  return this.request<Plan[]>(`/billing/plans${params}`);
};

ApiClient.prototype.getQuotaUsage = async function (): Promise<QuotaUsage> {
  return this.request<QuotaUsage>('/billing/quota');
};

ApiClient.prototype.createCheckout = async function (planId: string, interval: 'monthly' | 'yearly'): Promise<CheckoutResponse> {
  return this.request<CheckoutResponse>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ planId, interval }),
  });
};

ApiClient.prototype.cancelSubscription = async function (immediately = false): Promise<void> {
  await this.request(`/billing/cancel?immediately=${immediately}`, {
    method: 'POST',
  });
};

ApiClient.prototype.reactivateSubscription = async function (): Promise<void> {
  await this.request('/billing/reactivate', { method: 'POST' });
};

ApiClient.prototype.getBillingPortalUrl = async function (returnUrl: string): Promise<BillingPortalResponse> {
  return this.request<BillingPortalResponse>(`/billing/portal?returnUrl=${encodeURIComponent(returnUrl)}`);
};

ApiClient.prototype.getInvoices = async function (limit?: number): Promise<Invoice[]> {
  const params = limit ? `?limit=${limit}` : '';
  return this.request<Invoice[]>(`/billing/invoices${params}`);
};
