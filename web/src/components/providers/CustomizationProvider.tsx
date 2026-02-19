'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrandConfig, loadBrandConfig, updateBrandConfig, applyCSSVariables } from '@/lib/customization';

interface CustomizationContextType {
  brandConfig: BrandConfig;
  updateBrandConfig: (updates: Partial<BrandConfig>) => void;
  organizationId: string | null;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

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
        const orgRes = await fetch('/api/organizations/current', { credentials: 'include' });
        if (!orgRes.ok) return;
        const orgJson = await orgRes.json();
        const org = orgJson?.data ?? orgJson;
        if (!org?.id) return;
        setOrganizationId(org.id);

        const brandingRes = await fetch(`/api/organizations/${org.id}/branding`, { credentials: 'include' });
        if (!brandingRes.ok) return;
        const brandingJson = await brandingRes.json();
        const branding = brandingJson?.data ?? brandingJson;

        // Map API branding to BrandConfig
        const apiConfig: BrandConfig = {
          id: org.id,
          name: branding.name || org.name,
          logo: branding.logoUrl,
          primaryColor: branding.primaryColor || '#0284c7',
          secondaryColor: branding.secondaryColor || '#38bdf8',
          accentColor: branding.accentColor || '#0ea5e9',
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
          console.error('Failed to parse brand config from storage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleUpdateBrandConfig = async (updates: Partial<BrandConfig>) => {
    const newConfig = updateBrandConfig(updates);
    setBrandConfig(newConfig);
    applyCSSVariables(newConfig);

    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('brand-config', JSON.stringify(newConfig));
    }

    // Persist to API if we have an org ID
    if (organizationId) {
      try {
        await fetch(`/api/organizations/${organizationId}/branding`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: newConfig.name,
            logoUrl: newConfig.logo,
            primaryColor: newConfig.primaryColor,
            secondaryColor: newConfig.secondaryColor,
            accentColor: newConfig.accentColor,
            fontFamily: newConfig.fontFamily,
            showPoweredBy: newConfig.showPoweredBy,
            customDomain: newConfig.customDomain,
            customCSS: newConfig.customCSS,
          }),
        });
      } catch {
        // API save failed, localStorage still has the update
      }
    }
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

export function useCustomization() {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization must be used within CustomizationProvider');
  }
  return context;
}
