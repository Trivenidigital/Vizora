'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Promotion } from '@/lib/types';

interface PromotionFormProps {
  promotion?: Promotion | null;
  onSubmit: (data: Partial<Promotion>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PromotionForm({ promotion, onSubmit, onCancel, isLoading = false }: PromotionFormProps) {
  const [formData, setFormData] = useState<Partial<Promotion>>({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    currency: 'USD',
    maxRedemptions: null,
    maxPerCustomer: 1,
    minPurchaseAmount: null,
    startsAt: new Date().toISOString().slice(0, 16),
    expiresAt: null,
    isActive: true,
  });

  useEffect(() => {
    if (promotion) {
      setFormData({
        code: promotion.code,
        name: promotion.name,
        description: promotion.description || '',
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        currency: promotion.currency || 'USD',
        maxRedemptions: promotion.maxRedemptions,
        maxPerCustomer: promotion.maxPerCustomer,
        minPurchaseAmount: promotion.minPurchaseAmount,
        startsAt: promotion.startsAt ? new Date(promotion.startsAt).toISOString().slice(0, 16) : '',
        expiresAt: promotion.expiresAt ? new Date(promotion.expiresAt).toISOString().slice(0, 16) : null,
        isActive: promotion.isActive,
      });
    }
  }, [promotion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : undefined,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
    };
    await onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {promotion ? 'Edit Promotion' : 'Create Promotion'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition"
          >
            <X className="w-5 h-5 text-[var(--foreground-tertiary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent uppercase"
                placeholder="SUMMER20"
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
                placeholder="Summer Sale"
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
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Discount Type
              </label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData((p) => ({ ...p, discountType: e.target.value as Promotion['discountType'] }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="free_months">Free Months</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Discount Value
              </label>
              <input
                type="number"
                step={formData.discountType === 'percentage' ? '1' : '0.01'}
                value={formData.discountValue}
                onChange={(e) => setFormData((p) => ({ ...p, discountValue: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                min={0}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Max Redemptions
              </label>
              <input
                type="number"
                value={formData.maxRedemptions ?? ''}
                onChange={(e) => setFormData((p) => ({ ...p, maxRedemptions: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                placeholder="Unlimited"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Max Per Customer
              </label>
              <input
                type="number"
                value={formData.maxPerCustomer}
                onChange={(e) => setFormData((p) => ({ ...p, maxPerCustomer: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Starts At
              </label>
              <input
                type="datetime-local"
                value={formData.startsAt ? formData.startsAt.slice(0, 16) : ''}
                onChange={(e) => setFormData((p) => ({ ...p, startsAt: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Expires At
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt ? formData.expiresAt.slice(0, 16) : ''}
                onChange={(e) => setFormData((p) => ({ ...p, expiresAt: e.target.value || null }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
            />
            <span className="text-sm text-[var(--foreground-secondary)]">Active</span>
          </label>

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
                'Save Promotion'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
