// Organization API methods

import { ApiClient, Organization } from './client';

export interface BrandingConfig {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  showPoweredBy: boolean;
  customDomain?: string;
  customCSS?: string;
}

export type FeatureFlags = Record<string, boolean>;

declare module './client' {
  interface ApiClient {
    getOrganization(): Promise<Organization>;
    updateOrganization(id: string, data: Partial<{ name: string; country: string; gstin: string; settings: Record<string, any> }>): Promise<Organization>;
    getBranding(orgId: string): Promise<BrandingConfig>;
    updateBranding(orgId: string, data: Partial<BrandingConfig>): Promise<Organization>;
    uploadBrandingLogo(orgId: string, file: File): Promise<{ logoUrl: string }>;
    getFeatureFlags(): Promise<FeatureFlags>;
    updateFeatureFlags(flags: Partial<FeatureFlags>): Promise<FeatureFlags>;
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

ApiClient.prototype.getBranding = async function (orgId: string): Promise<BrandingConfig> {
  return this.request<BrandingConfig>(`/organizations/${orgId}/branding`);
};

ApiClient.prototype.updateBranding = async function (orgId: string, data: Partial<BrandingConfig>): Promise<Organization> {
  return this.request<Organization>(`/organizations/${orgId}/branding`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.uploadBrandingLogo = async function (orgId: string, file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return this.requestFormData<{ logoUrl: string }>(`/organizations/${orgId}/branding/logo`, formData);
};

ApiClient.prototype.getFeatureFlags = async function (): Promise<FeatureFlags> {
  return this.request<FeatureFlags>('/organizations/feature-flags');
};

ApiClient.prototype.updateFeatureFlags = async function (flags: Partial<FeatureFlags>): Promise<FeatureFlags> {
  return this.request<FeatureFlags>('/organizations/feature-flags', {
    method: 'PATCH',
    body: JSON.stringify(flags),
  });
};
