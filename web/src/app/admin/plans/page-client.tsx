'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { AdminPlan } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { PlanForm } from '../components/PlanForm';
import { StatusBadge } from '../components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Plus, Edit, Trash2, Check, DollarSign } from 'lucide-react';

interface AdminPlansClientProps {
  initialPlans?: AdminPlan[] | null;
}

export default function AdminPlansClient({ initialPlans }: AdminPlansClientProps) {
  const toast = useToast();
  const [plans, setPlans] = useState<AdminPlan[]>(initialPlans || []);
  const [loading, setLoading] = useState(!initialPlans);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<AdminPlan | null>(null);

  useEffect(() => {
    if (!initialPlans) {
      loadPlans();
    }
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAdminPlans();
      setPlans(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const handleEdit = (plan: AdminPlan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleSubmit = async (data: Partial<AdminPlan>) => {
    try {
      setFormLoading(true);
      if (editingPlan) {
        await apiClient.updatePlan(editingPlan.id, data);
        toast.success('Plan updated successfully');
      } else {
        await apiClient.createPlan(data);
        toast.success('Plan created successfully');
      }
      setShowForm(false);
      setEditingPlan(null);
      loadPlans();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save plan');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    try {
      await apiClient.deletePlan(deletingPlan.id);
      toast.success('Plan deleted successfully');
      setDeletingPlan(null);
      loadPlans();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete plan');
    }
  };

  const formatPrice = (amount: number, currency: 'USD' | 'INR' = 'USD') => {
    if (currency === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
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
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Plans</h1>
          <p className="mt-1 text-[var(--foreground-secondary)]">
            Manage subscription plans and pricing
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
        >
          <Plus className="w-5 h-5" />
          Create Plan
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-[var(--surface)] rounded-xl border-2 ${
              plan.highlightText
                ? 'border-[#00E5A0]'
                : 'border-[var(--border)]'
            } overflow-hidden relative`}
          >
            {plan.highlightText && (
              <div className="absolute top-0 left-0 right-0 bg-[#00E5A0] text-[#061A21] text-center text-sm font-medium py-1">
                {plan.highlightText}
              </div>
            )}

            <div className={`p-6 ${plan.highlightText ? 'pt-10' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{plan.name}</h3>
                  <p className="text-sm text-[var(--foreground-tertiary)]">{plan.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={plan.isActive ? 'active' : 'inactive'} size="sm" />
                  {!plan.isPublic && (
                    <span className="px-2 py-0.5 text-xs bg-[var(--background-secondary)] text-[var(--foreground-secondary)] rounded">
                      Hidden
                    </span>
                  )}
                </div>
              </div>

              {plan.description && (
                <p className="text-sm text-[var(--foreground-secondary)] mb-4">{plan.description}</p>
              )}

              {/* Pricing */}
              <div className="space-y-2 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[var(--foreground)]">
                    {formatPrice(plan.priceUsdMonthly)}
                  </span>
                  <span className="text-[var(--foreground-tertiary)]">/mo</span>
                </div>
                <div className="text-sm text-[var(--foreground-tertiary)]">
                  {formatPrice(plan.priceUsdYearly)}/year |{' '}
                  {formatPrice(plan.priceInrMonthly, 'INR')}/mo INR
                </div>
              </div>

              {/* Quotas */}
              <div className="space-y-2 mb-4 py-4 border-y border-[var(--border)]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--foreground-secondary)]">Screens</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {plan.screenQuota}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--foreground-secondary)]">Storage</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {plan.storageQuotaMb >= 1024
                      ? `${(plan.storageQuotaMb / 1024).toFixed(0)} GB`
                      : `${plan.storageQuotaMb} MB`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--foreground-secondary)]">API Rate Limit</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {plan.apiRateLimit.toLocaleString()}/hr
                  </span>
                </div>
              </div>

              {/* Features */}
              {plan.features && plan.features.length > 0 && (
                <div className="space-y-2 mb-4">
                  {plan.features.slice(0, 4).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-[var(--foreground-secondary)]">{feature}</span>
                    </div>
                  ))}
                  {plan.features.length > 4 && (
                    <p className="text-sm text-[var(--foreground-tertiary)]">
                      +{plan.features.length - 4} more features
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
                <button
                  onClick={() => handleEdit(plan)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setDeletingPlan(plan)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">No plans yet</h3>
          <p className="text-[var(--foreground-secondary)] mb-4">
            Create your first subscription plan to get started.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
          >
            <Plus className="w-5 h-5" />
            Create Plan
          </button>
        </div>
      )}

      {/* Plan Form Modal */}
      {showForm && (
        <PlanForm
          plan={editingPlan}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingPlan(null);
          }}
          isLoading={formLoading}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingPlan}
        onClose={() => setDeletingPlan(null)}
        onConfirm={handleDelete}
        title="Delete Plan"
        message={`Are you sure you want to delete the "${deletingPlan?.name}" plan? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
