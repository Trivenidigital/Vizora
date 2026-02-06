'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { Promotion } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { PromotionForm } from '../components/PromotionForm';
import { StatusBadge } from '../components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Plus, Edit, Trash2, Gift, Copy, Check, Calendar, Users } from 'lucide-react';

export default function AdminPromotionsPage() {
  const toast = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAdminPromotions();
      setPromotions(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPromotion(null);
    setShowForm(true);
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setShowForm(true);
  };

  const handleSubmit = async (data: Partial<Promotion>) => {
    try {
      setFormLoading(true);
      if (editingPromotion) {
        await apiClient.updatePromotion(editingPromotion.id, data);
        toast.success('Promotion updated successfully');
      } else {
        await apiClient.createPromotion(data);
        toast.success('Promotion created successfully');
      }
      setShowForm(false);
      setEditingPromotion(null);
      loadPromotions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save promotion');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPromotion) return;
    try {
      await apiClient.deletePromotion(deletingPromotion.id);
      toast.success('Promotion deleted successfully');
      setDeletingPromotion(null);
      loadPromotions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete promotion');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDiscount = (promo: Promotion) => {
    switch (promo.discountType) {
      case 'percentage':
        return `${promo.discountValue}%`;
      case 'fixed_amount':
        return `$${promo.discountValue}`;
      case 'free_months':
        return `${promo.discountValue} free month${promo.discountValue > 1 ? 's' : ''}`;
      default:
        return String(promo.discountValue);
    }
  };

  const isExpired = (promo: Promotion) => {
    if (!promo.expiresAt) return false;
    return new Date(promo.expiresAt) < new Date();
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Promotions</h1>
          <p className="mt-1 text-[var(--foreground-secondary)]">
            Manage discount codes and promotional offers
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
        >
          <Plus className="w-5 h-5" />
          Create Promotion
        </button>
      </div>

      {/* Promotions Table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--background)] border-b border-[var(--border)]">
                <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Code
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Discount
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Redemptions
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Validity
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => (
                <tr
                  key={promo.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-[var(--background-secondary)] rounded text-sm font-mono font-medium text-[var(--foreground)]">
                        {promo.code}
                      </code>
                      <button
                        onClick={() => copyCode(promo.code)}
                        className="p-1 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] transition"
                        title="Copy code"
                      >
                        {copiedCode === promo.code ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{promo.name}</p>
                      {promo.description && (
                        <p className="text-sm text-[var(--foreground-tertiary)] truncate max-w-xs">
                          {promo.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                      {formatDiscount(promo)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[var(--foreground-tertiary)]" />
                      <span className="text-[var(--foreground)]">
                        {promo.currentRedemptions}
                        {promo.maxRedemptions && (
                          <span className="text-[var(--foreground-tertiary)]">
                            {' '}
                            / {promo.maxRedemptions}
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)]">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {formatDate(promo.startsAt)}
                        {promo.expiresAt && ` - ${formatDate(promo.expiresAt)}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={isExpired(promo) ? 'error' : promo.isActive ? 'active' : 'inactive'}
                      size="sm"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(promo)}
                        className="p-2 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingPromotion(promo)}
                        className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {promotions.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
              No promotions yet
            </h3>
            <p className="text-[var(--foreground-secondary)] mb-4">
              Create your first promotional code to attract customers.
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
            >
              <Plus className="w-5 h-5" />
              Create Promotion
            </button>
          </div>
        )}
      </div>

      {/* Promotion Form Modal */}
      {showForm && (
        <PromotionForm
          promotion={editingPromotion}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingPromotion(null);
          }}
          isLoading={formLoading}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingPromotion}
        onClose={() => setDeletingPromotion(null)}
        onConfirm={handleDelete}
        title="Delete Promotion"
        message={`Are you sure you want to delete the "${deletingPromotion?.name}" promotion? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
