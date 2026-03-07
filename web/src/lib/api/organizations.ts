// Organization API methods

import { ApiClient, Organization } from './client';

declare module './client' {
  interface ApiClient {
    getOrganization(): Promise<Organization>;
    updateOrganization(id: string, data: Partial<{ name: string; country: string; gstin: string; settings: Record<string, any> }>): Promise<Organization>;
  }
}

ApiClient.prototype.getOrganization = async function (): Promise<Organization> {
  return this.request<Organization>('/organizations/current');
};

ApiClient.prototype.updateOrganization = async function (id: string, data: Partial<{ name: string; country: string; gstin: string; settings: Record<string, any> }>): Promise<Organization> {
  return this.request<Organization>(`/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};
