// Alert Rules API methods (O7 — configurable downtime alert rules)
//
// Wraps the admin-gated CRUD + recipient endpoints under
// `/notifications/alert-rules`. Mutations (POST/PATCH/DELETE and recipient
// add/remove) are admin-only on the server (RolesGuard @Roles('admin')); the
// UI mirrors that gate but the server is the source of truth.

import type {
  AlertRule,
  AlertRuleRecipient,
  AlertChannel,
  AlertScope,
} from '../types';
import { ApiClient } from './client';

export interface AlertRuleRecipientInput {
  channel: AlertChannel;
  target: string;
}

export interface CreateAlertRuleInput {
  name: string;
  triggerEvent: string;
  scope: AlertScope;
  scopeTagId?: string;
  scopeGroupId?: string;
  scopeDisplayId?: string;
  minOfflineSec?: number;
  isActive?: boolean;
  recipients: AlertRuleRecipientInput[];
}

// Recipients are managed via the dedicated add/remove endpoints, so the
// update payload omits them (mirrors the server's UpdateAlertRuleDto).
export type UpdateAlertRuleInput = Partial<Omit<CreateAlertRuleInput, 'recipients'>>;

declare module './client' {
  interface ApiClient {
    getAlertRules(params?: { isActive?: boolean; triggerEvent?: string }): Promise<AlertRule[]>;
    getAlertRule(id: string): Promise<AlertRule>;
    createAlertRule(data: CreateAlertRuleInput): Promise<AlertRule>;
    updateAlertRule(id: string, data: UpdateAlertRuleInput): Promise<AlertRule>;
    deleteAlertRule(id: string): Promise<void>;
    addAlertRuleRecipient(id: string, data: AlertRuleRecipientInput): Promise<AlertRuleRecipient>;
    removeAlertRuleRecipient(id: string, recipientId: string): Promise<void>;
  }
}

ApiClient.prototype.getAlertRules = async function (params?: {
  isActive?: boolean;
  triggerEvent?: string;
}): Promise<AlertRule[]> {
  const queryParams: Record<string, string> = {};
  if (params?.isActive !== undefined) queryParams.isActive = String(params.isActive);
  if (params?.triggerEvent) queryParams.triggerEvent = params.triggerEvent;
  const query = Object.keys(queryParams).length > 0
    ? `?${new URLSearchParams(queryParams).toString()}`
    : '';
  return this.request<AlertRule[]>(`/notifications/alert-rules${query}`);
};

ApiClient.prototype.getAlertRule = async function (id: string): Promise<AlertRule> {
  return this.request<AlertRule>(`/notifications/alert-rules/${id}`);
};

ApiClient.prototype.createAlertRule = async function (data: CreateAlertRuleInput): Promise<AlertRule> {
  return this.request<AlertRule>('/notifications/alert-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateAlertRule = async function (
  id: string,
  data: UpdateAlertRuleInput,
): Promise<AlertRule> {
  return this.request<AlertRule>(`/notifications/alert-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.deleteAlertRule = async function (id: string): Promise<void> {
  return this.request<void>(`/notifications/alert-rules/${id}`, {
    method: 'DELETE',
  });
};

ApiClient.prototype.addAlertRuleRecipient = async function (
  id: string,
  data: AlertRuleRecipientInput,
): Promise<AlertRuleRecipient> {
  return this.request<AlertRuleRecipient>(`/notifications/alert-rules/${id}/recipients`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.removeAlertRuleRecipient = async function (
  id: string,
  recipientId: string,
): Promise<void> {
  return this.request<void>(`/notifications/alert-rules/${id}/recipients/${recipientId}`, {
    method: 'DELETE',
  });
};
