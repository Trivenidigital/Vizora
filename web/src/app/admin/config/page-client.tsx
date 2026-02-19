'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { SystemConfig } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { ConfigEditor } from '../components/ConfigEditor';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Settings, Search, Filter, ChevronDown } from 'lucide-react';

interface AdminConfigClientProps {
  initialConfigs?: SystemConfig[] | null;
}

export default function AdminConfigClient({ initialConfigs }: AdminConfigClientProps) {
  const toast = useToast();
  const [configs, setConfigs] = useState<SystemConfig[]>(initialConfigs || []);
  const [loading, setLoading] = useState(!initialConfigs);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    if (!initialConfigs) {
      loadConfigs();
    }
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSystemConfigs();
      setConfigs(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: any) => {
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      await apiClient.updateSystemConfig(key, value);
      toast.success(`Configuration "${key}" updated successfully`);
      loadConfigs(); // Reload to get fresh data
    } catch (error: any) {
      toast.error(error.message || `Failed to update "${key}"`);
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Get unique categories
  const categories = Array.from(new Set(configs.map((c) => c.category))).sort();

  // Filter configs
  const filteredConfigs = configs.filter((config) => {
    const matchesSearch =
      !search ||
      config.key.toLowerCase().includes(search.toLowerCase()) ||
      (config.description?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || config.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedConfigs = filteredConfigs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, SystemConfig[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">System Configuration</h1>
        <p className="mt-1 text-[var(--foreground-secondary)]">
          Manage platform settings and feature flags
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search configuration keys..."
            className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
          />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent appearance-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-tertiary)] pointer-events-none" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-tertiary)] pointer-events-none" />
        </div>
      </div>

      {/* Config Groups */}
      {Object.keys(groupedConfigs).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedConfigs)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, categoryConfigs]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[var(--foreground-tertiary)]" />
                  {category}
                  <span className="text-sm font-normal text-[var(--foreground-tertiary)]">
                    ({categoryConfigs.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {categoryConfigs
                    .sort((a, b) => a.key.localeCompare(b.key))
                    .map((config) => (
                      <ConfigEditor
                        key={config.id}
                        config={config}
                        onSave={handleSave}
                        isLoading={savingKeys.has(config.key)}
                      />
                    ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <Settings className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
            No configuration found
          </h3>
          <p className="text-[var(--foreground-secondary)]">
            {search || categoryFilter
              ? 'Try adjusting your search or filters.'
              : 'System configuration will appear here.'}
          </p>
        </div>
      )}

      {/* Info */}
      <div className="p-4 bg-[#00E5A0]/5 border border-[#00E5A0]/20 rounded-lg">
        <p className="text-sm text-[#00E5A0]">
          <strong>Note:</strong> Changes to configuration values take effect immediately. Some
          settings may require a service restart to fully apply. Secret values are encrypted and
          not displayed in full.
        </p>
      </div>
    </div>
  );
}
