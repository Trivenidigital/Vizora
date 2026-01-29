'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrandConfig, loadBrandConfig, updateBrandConfig, applyCSSVariables } from '@/lib/customization';

interface CustomizationContextType {
  brandConfig: BrandConfig;
  updateBrandConfig: (updates: Partial<BrandConfig>) => void;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export function CustomizationProvider({ children }: { children: React.ReactNode }) {
  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize customization from API or config
  useEffect(() => {
    setIsMounted(true);

    // Load brand config
    const config = loadBrandConfig();
    setBrandConfig(config);

    // Apply CSS variables
    applyCSSVariables(config);

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

  const handleUpdateBrandConfig = (updates: Partial<BrandConfig>) => {
    const newConfig = updateBrandConfig(updates);
    setBrandConfig(newConfig);
    applyCSSVariables(newConfig);

    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('brand-config', JSON.stringify(newConfig));
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
