'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { AdminPlan } from '@/lib/types';

interface PlanFormProps {
  plan?: AdminPlan | null;
  onSubmit: (data: Partial<AdminPlan>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PlanForm({ plan, onSubmit, onCancel, isLoading = false }: PlanFormProps) {
  const [formData, setFormData] = useState<Partial<AdminPlan>>({
    slug: '',
    name: '',
    description: '',
    screenQuota: 5,
    storageQuotaMb: 1024,
    apiRateLimit: 1000,
    priceUsdMonthly: 0,
    priceUsdYearly: 0,
    priceInrMonthly: 0,
    priceInrYearly: 0,
    stripePriceIdMonthly: '',
    stripePriceIdYearly: '',
    razorpayPlanIdMonthly: '',
    razorpayPlanIdYearly: '',
    features: [],
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    highlightText: '',
  });
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    if (plan) {
      setFormData({
        slug: plan.slug,
        name: plan.name,
        description: plan.description || '',
        screenQuota: plan.screenQuota,
        storageQuotaMb: plan.storageQuotaMb,
        apiRateLimit: plan.apiRateLimit,
        priceUsdMonthly: plan.priceUsdMonthly,
        priceUsdYearly: plan.priceUsdYearly,
        priceInrMonthly: plan.priceInrMonthly,
        priceInrYearly: plan.priceInrYearly,
        stripePriceIdMonthly: plan.stripePriceIdMonthly || '',
        stripePriceIdYearly: plan.stripePriceIdYearly || '',
        razorpayPlanIdMonthly: plan.razorpayPlanIdMonthly || '',
        razorpayPlanIdYearly: plan.razorpayPlanIdYearly || '',
        features: plan.features || [],
        isActive: plan.isActive,
        isPublic: plan.isPublic,
        sortOrder: plan.sortOrder,
        highlightText: plan.highlightText || '',
      });
    }
  }, [plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData((prev) => ({
        ...prev,
        features: [...(prev.features || []), newFeature.trim()],
      }));
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      features: (prev.features || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {plan ? 'Edit Plan' : 'Create Plan'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition"
          >
            <X className="w-5 h-5 text-[var(--foreground-tertiary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                placeholder="professional"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                placeholder="Professional"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              placeholder="For growing businesses"
            />
          </div>

          {/* Quotas */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Screen Quota
              </label>
              <input
                type="number"
                value={formData.screenQuota}
                onChange={(e) => setFormData((p) => ({ ...p, screenQuota: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Storage (MB)
              </label>
              <input
                type="number"
                value={formData.storageQuotaMb}
                onChange={(e) => setFormData((p) => ({ ...p, storageQuotaMb: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                API Rate Limit
              </label>
              <input
                type="number"
                value={formData.apiRateLimit}
                onChange={(e) => setFormData((p) => ({ ...p, apiRateLimit: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                min={0}
              />
            </div>
          </div>

          {/* Pricing - USD */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Pricing (USD)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                  Monthly ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.priceUsdMonthly}
                  onChange={(e) => setFormData((p) => ({ ...p, priceUsdMonthly: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                  Yearly ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.priceUsdYearly}
                  onChange={(e) => setFormData((p) => ({ ...p, priceUsdYearly: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Pricing - INR */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Pricing (INR)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                  Monthly (Rs)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.priceInrMonthly}
                  onChange={(e) => setFormData((p) => ({ ...p, priceInrMonthly: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                  Yearly (Rs)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.priceInrYearly}
                  onChange={(e) => setFormData((p) => ({ ...p, priceInrYearly: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
              Features
            </label>
            <div className="space-y-2">
              {(formData.features || []).map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-2 bg-[var(--background-secondary)] rounded-lg text-sm text-[var(--foreground-secondary)]">
                    {feature}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  placeholder="Add a feature..."
                  className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addFeature}
                  className="p-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Highlight Text
              </label>
              <input
                type="text"
                value={formData.highlightText || ''}
                onChange={(e) => setFormData((p) => ({ ...p, highlightText: e.target.value }))}
                placeholder="Most Popular"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
              />
              <span className="text-sm text-[var(--foreground-secondary)]">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData((p) => ({ ...p, isPublic: e.target.checked }))}
                className="w-4 h-4 rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
              />
              <span className="text-sm text-[var(--foreground-secondary)]">Public</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#061A21]/30 border-t-[#061A21] rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Plan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
