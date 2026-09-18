'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  BrandConfig,
  loadBrandConfig,
  applyCSSVariables,
  defaultBrandConfig,
} from '@/lib/customization';
import { apiClient } from '@/lib/api';

interface CustomizationContextType {
  brandConfig: BrandConfig;
  updateBrandConfig: (updates: Partial<BrandConfig>) => Promise<BrandConfig>;
  organizationId: string | null;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

/*
 * The default config is IMPORTED, not restated.
 *
 * It was declared twice — here and in lib/customization.ts — with identical
 * values, which is the arrangement that drifts. It matters more than an
 * ordinary duplicate because these colours are not a fallback nobody sees:
 * they are the `||` operands below, and `applyCSSVariables` publishes the
 * result as an inline `--primary` on <html>, which beats the `:root` palette
 * for every signed-in tenant. A third copy lives server-side in
 * `organizations.service.ts` `getBranding()` and is the one that actually
 * decides; see the comment at the definition site for why none of them has
 * been moved off the retired neon yet.
 */

export function CustomizationProvider({ children }: { children: React.ReactNode }) {
  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize customization from API with localStorage fallback
  useEffect(() => {
    setIsMounted(true);

    // Load cached config from localStorage as initial value
    const cached = typeof window !== 'undefined' ? localStorage.getItem('brand-config') : null;
    if (cached) {
      try {
        const cachedConfig = JSON.parse(cached) as BrandConfig;
        setBrandConfig(cachedConfig);
        applyCSSVariables(cachedConfig);
      } catch {
        // Ignore parse errors, will load default
      }
    }

    // If no cached config, use default
    if (!cached) {
      const config = loadBrandConfig();
      setBrandConfig(config);
      applyCSSVariables(config);
    }

    // Fetch branding from API
    const fetchBranding = async () => {
      try {
        const orgRes = await fetch('/api/v1/organizations/current', { credentials: 'include' });
        if (!orgRes.ok) return;
        const orgJson = await orgRes.json();
        const org = orgJson?.data ?? orgJson;
        if (!org?.id) return;
        setOrganizationId(org.id);

        const brandingRes = await fetch(`/api/v1/organizations/${org.id}/branding`, { credentials: 'include' });
        if (!brandingRes.ok) return;
        const brandingJson = await brandingRes.json();
        const branding = brandingJson?.data ?? brandingJson;

        // Map API branding to BrandConfig
        const apiConfig: BrandConfig = {
          id: org.id,
          name: branding.name || org.name,
          logo: branding.logoUrl,
          primaryColor: branding.primaryColor || defaultBrandConfig.primaryColor,
          secondaryColor: branding.secondaryColor || defaultBrandConfig.secondaryColor,
          accentColor: branding.accentColor || defaultBrandConfig.accentColor,
          fontFamily: branding.fontFamily || 'sans',
          showPoweredBy: branding.showPoweredBy ?? true,
          customDomain: branding.customDomain || '',
          customCSS: branding.customCSS || '',
        };

        setBrandConfig(apiConfig);
        applyCSSVariables(apiConfig);
        loadBrandConfig(apiConfig);
        localStorage.setItem('brand-config', JSON.stringify(apiConfig));
      } catch {
        // API not available, keep cached/default config
      }
    };

    fetchBranding();

    // Listen for storage changes (multi-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'brand-config' && e.newValue) {
        try {
          const newConfig = JSON.parse(e.newValue) as BrandConfig;
          setBrandConfig(newConfig);
          applyCSSVariables(newConfig);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to parse brand config from storage:', error);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleUpdateBrandConfig = async (updates: Partial<BrandConfig>) => {
    const newConfig = {
      ...(brandConfig ?? loadBrandConfig()),
      ...updates,
    };

    if (!organizationId) {
      throw new Error('Organization branding is still loading');
    }

    await apiClient.updateBranding(organizationId, {
      name: newConfig.name,
      logoUrl: newConfig.logo,
      primaryColor: newConfig.primaryColor,
      secondaryColor: newConfig.secondaryColor,
      accentColor: newConfig.accentColor,
      fontFamily: newConfig.fontFamily,
      showPoweredBy: newConfig.showPoweredBy,
      customDomain: newConfig.customDomain,
      customCSS: newConfig.customCSS,
    });

    setBrandConfig(newConfig);
    applyCSSVariables(newConfig);
    loadBrandConfig(newConfig);

    // Save to localStorage after the durable API write succeeds.
    if (typeof window !== 'undefined') {
      localStorage.setItem('brand-config', JSON.stringify(newConfig));
    }
    return newConfig;
  };

  // Don't render until client-side hydration is complete
  if (!isMounted || !brandConfig) {
    return <>{children}</>;
  }

  return (
    <CustomizationContext.Provider
      value={{
        brandConfig,
        updateBrandConfig: handleUpdateBrandConfig,
        organizationId,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
}

// Default fallback when context is not yet available (pre-hydration)
const defaultCustomizationContext: CustomizationContextType = {
  brandConfig: defaultBrandConfig,
  updateBrandConfig: async () => {
    throw new Error('Organization branding is still loading');
  },
  organizationId: null,
};

export function useCustomization() {
  const context = useContext(CustomizationContext);
  // Return default context during SSR / pre-hydration instead of throwing
  return context ?? defaultCustomizationContext;
}
