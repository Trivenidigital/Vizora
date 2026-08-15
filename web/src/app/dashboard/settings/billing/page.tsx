'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import type { SubscriptionStatus, QuotaUsage } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from './components/status-badge';
import { QuotaBar } from './components/quota-bar';

export default function BillingPage() {
 const router = useRouter();
 const toast = useToast();
 const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
 const [quota, setQuota] = useState<QuotaUsage | null>(null);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState(false);
 const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
 const [gstin, setGstin] = useState('');
 const [gstinSaving, setGstinSaving] = useState(false);
 const [orgId, setOrgId] = useState<string | null>(null);
 const [loadError, setLoadError] = useState<string | null>(null);

 useEffect(() => {
 loadBillingData();
 }, []);

 const loadBillingData = async () => {
 try {
 setLoading(true);
 setLoadError(null);
 const [subData, quotaData, orgData] = await Promise.all([
 apiClient.getSubscriptionStatus(),
 apiClient.getQuotaUsage(),
 apiClient.getOrganization(),
 ]);
 setSubscription(subData);
 setQuota(quotaData);
 setOrgId(orgData.id);
 if (orgData.gstin) {
  setGstin(orgData.gstin);
 }
 } catch (error: any) {
 setLoadError(error.message || 'Failed to load billing information');
 toast.error(error.message || 'Failed to load billing information');
 } finally {
 setLoading(false);
 }
 };

 const handleManageBilling = async () => {
 if (!subscription?.paymentProvider) {
 toast.error('No payment provider configured');
 return;
 }

 try {
 setActionLoading(true);
 const returnUrl = window.location.href;
 const { url } = await apiClient.getBillingPortalUrl(returnUrl);
 window.location.href = url;
 } catch (error: any) {
 toast.error(error.message || 'Failed to open billing portal');
 setActionLoading(false);
 }
 };

 const handleCancelSubscription = async () => {
 try {
 setActionLoading(true);
 await apiClient.cancelSubscription(false);
 toast.success('Subscription will be canceled at the end of the billing period');
 setIsCancelDialogOpen(false);
 loadBillingData();
 } catch (error: any) {
 toast.error(error.message || 'Failed to cancel subscription');
 } finally {
 setActionLoading(false);
 }
 };

 const handleReactivateSubscription = async () => {
 try {
 setActionLoading(true);
 await apiClient.reactivateSubscription();
 toast.success('Subscription reactivated successfully');
 loadBillingData();
 } catch (error: any) {
 toast.error(error.message || 'Failed to reactivate subscription');
 } finally {
 setActionLoading(false);
 }
 };

 const handleSaveGstin = async () => {
 if (!orgId) return;
 try {
  setGstinSaving(true);
  await apiClient.updateOrganization(orgId, { gstin });
  toast.success('GSTIN saved successfully');
 } catch (error: any) {
  toast.error(error.message || 'Failed to save GSTIN');
 } finally {
  setGstinSaving(false);
 }
 };

 const formatDate = (dateStr: string | null) => {
 if (!dateStr) return 'N/A';
 return new Date(dateStr).toLocaleDateString('en-US', {
 month: 'long',
 day: 'numeric',
 year: 'numeric',
 });
 };

 const isTrialing = subscription?.subscriptionStatus === 'trial';
 const isCanceled = subscription?.cancelAtPeriodEnd;
 // Stated positively on purpose: missing subscription data must mean "not paid".
 // The previous negative form (`tier !== 'free'`) was TRUE for a null subscription,
 // which gated a real "Cancel Subscription" button onto a failed data load.
 const isPaidPlan =
  !!subscription?.subscriptionTier && subscription.subscriptionTier.toLowerCase() !== 'free';
 // The provider could not be read, so cancelAtPeriodEnd is UNKNOWN rather than
 // false. Offering "Cancel Subscription" here would show the cancel action to a
 // customer who has already cancelled.
 const isPeriodDataDegraded = subscription?.degraded === true;

 if (loading) {
 return (
 <div className="space-y-6">
 <div>
 <h2 className="eh-heading font-sora text-2xl text-[var(--foreground)]">Billing</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Manage your subscription and billing details
 </p>
 </div>
 <div className="bg-[var(--surface)] rounded-lg shadow p-12">
 <LoadingSpinner size="lg" />
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <toast.ToastContainer />

 <div className="flex justify-between items-start">
 <div>
 <h2 className="eh-heading font-sora text-2xl text-[var(--foreground)]">Billing</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Manage your subscription and billing details
 </p>
 </div>
 <Link
 href="/dashboard/settings/billing/history"
 className="text-[#00E5A0] hover:text-[#00E5A0] dark:text-[#00E5A0] dark:hover:text-[#00CC8E] text-sm font-medium flex items-center gap-1"
 >
 View Invoice History
 <Icon name="chevronRight" size="sm" />
 </Link>
 </div>

 {/* Load failure — never render plan data or subscription actions from a failed
     read. A missing subscription used to render as "Free" plus a live
     "Cancel Subscription" button, which really cancels on the provider. */}
 {loadError ? (
 <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
 <p>Unable to load your billing information. Your plan is unchanged — please try again.</p>
 <p className="mt-1 text-xs opacity-80">{loadError}</p>
 <button
 onClick={() => loadBillingData()}
 className="mt-3 px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
 >
 Retry
 </button>
 </div>
 ) : (
 <>
 {/* Current Plan Card */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md overflow-hidden">
 <div className="p-6 border-b border-[var(--border)]">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">Current Plan</h3>
 <p className="text-sm text-[var(--foreground-tertiary)]">
 Your organization&apos;s subscription details
 </p>
 </div>
 <StatusBadge status={subscription?.subscriptionStatus || '—'} />
 </div>
 </div>

 <div className="p-6">
 <div className="flex items-start justify-between mb-6">
 <div>
 <div className="text-3xl font-bold text-[var(--foreground)] capitalize">
 {subscription?.subscriptionTier || '—'}
 </div>
 {isTrialing && subscription?.trialEndsAt && (
 <p className="text-sm text-[#00E5A0] dark:text-[#00E5A0] mt-1">
 Trial ends {formatDate(subscription.trialEndsAt)}
 </p>
 )}
 {isCanceled && subscription?.currentPeriodEnd && (
 <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
 Access until {formatDate(subscription.currentPeriodEnd)}
 </p>
 )}
 {!isCanceled && subscription?.currentPeriodEnd && isPaidPlan && (
 <p className="text-sm text-[var(--foreground-tertiary)] mt-1">
 Renews {formatDate(subscription.currentPeriodEnd)}
 </p>
 )}
 </div>
 <Link
 href="/dashboard/settings/billing/plans"
 className="px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium text-sm"
 >
 {isPaidPlan ? 'Change Plan' : 'Upgrade'}
 </Link>
 </div>

 {/* Quota Usage */}
 {quota && (
 <div className="bg-[var(--background)] rounded-lg p-4">
 <QuotaBar used={quota.screensUsed} total={quota.screenQuota} label="Screen Usage" />
 </div>
 )}
 </div>

 {/* Actions Footer */}
 {isPaidPlan && (
 <div className="px-6 py-4 bg-[var(--background)]/50 border-t border-[var(--border)]">
 <div className="flex flex-wrap gap-4">
 {subscription?.paymentProvider && (
 <button
 onClick={handleManageBilling}
 disabled={actionLoading}
 className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition flex items-center gap-2"
 >
 {actionLoading ? <LoadingSpinner size="sm" /> : <Icon name="settings" size="sm" />}
 Manage Billing
 </button>
 )}

 {isPeriodDataDegraded ? (
 <p className="text-sm text-[var(--foreground-tertiary)] self-center">
 Subscription details are temporarily unavailable — plan actions are disabled.
 </p>
 ) : isCanceled ? (
 <button
 onClick={handleReactivateSubscription}
 disabled={actionLoading}
 className="px-4 py-2 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 transition flex items-center gap-2"
 >
 {actionLoading ? <LoadingSpinner size="sm" /> : <Icon name="refresh" size="sm" />}
 Reactivate Subscription
 </button>
 ) : (
 <button
 onClick={() => setIsCancelDialogOpen(true)}
 disabled={actionLoading}
 className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition"
 >
 Cancel Subscription
 </button>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Payment Provider Info — inside the guard: `subscription` is never cleared
     on failure, so a failed RE-load (after cancel/reactivate) would otherwise
     render these two from stale state beside the error panel. */}
 {subscription?.paymentProvider && (
 <div className="bg-[var(--background)] rounded-lg p-4">
 <div className="flex items-center gap-3">
 <Icon name="shield" size="lg" className="text-[var(--foreground-tertiary)]" />
 <div>
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">
 Payments processed by{' '}
 <span className="capitalize">{subscription.paymentProvider}</span>
 </p>
 <p className="text-xs text-[var(--foreground-tertiary)]">
 All payment information is securely stored with our payment provider
 </p>
 </div>
 </div>
 </div>
 )}

 {/* GSTIN field for Indian organizations */}
 {subscription?.paymentProvider === 'razorpay' && (
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Tax Information</h3>
  <div>
   <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
    GSTIN (GST Identification Number)
   </label>
   <input
    type="text"
    value={gstin}
    onChange={(e) => setGstin(e.target.value.toUpperCase())}
    placeholder="e.g., 22AAAAA0000A1Z5"
    maxLength={15}
    className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent font-mono"
   />
   <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
    Required for GST-compliant invoices in India
   </p>
   <button
    onClick={handleSaveGstin}
    disabled={gstinSaving}
    className="mt-3 px-4 py-2 text-sm font-medium bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition flex items-center gap-2"
   >
    {gstinSaving && <LoadingSpinner size="sm" />}
    Save GSTIN
   </button>
  </div>
 </div>
 )}
 </>
 )}

 {/* Quick Links */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Link
 href="/dashboard/settings/billing/plans"
 className="bg-[var(--surface)] rounded-lg shadow-md p-6 hover:shadow-lg transition group"
 >
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-[#00E5A0]/10 dark:bg-[#00E5A0]/10 rounded-lg flex items-center justify-center">
 <Icon name="list" size="lg" className="text-[#00E5A0] dark:text-[#00E5A0]" />
 </div>
 <div className="flex-1">
 <h4 className="font-semibold text-[var(--foreground)] group-hover:text-[#00E5A0] dark:group-hover:text-[#00E5A0] transition">
 Compare Plans
 </h4>
 <p className="text-sm text-[var(--foreground-tertiary)]">
 View all available plans and features
 </p>
 </div>
 <Icon
 name="chevronRight"
 size="md"
 className="text-[var(--foreground-tertiary)] group-hover:text-[#00E5A0] dark:group-hover:text-[#00E5A0] transition"
 />
 </div>
 </Link>

 <Link
 href="/dashboard/settings/billing/history"
 className="bg-[var(--surface)] rounded-lg shadow-md p-6 hover:shadow-lg transition group"
 >
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-[var(--background-secondary)] rounded-lg flex items-center justify-center">
 <Icon name="document" size="lg" className="text-[var(--foreground-secondary)]" />
 </div>
 <div className="flex-1">
 <h4 className="font-semibold text-[var(--foreground)] group-hover:text-[#00E5A0] dark:group-hover:text-[#00E5A0] transition">
 Invoice History
 </h4>
 <p className="text-sm text-[var(--foreground-tertiary)]">
 Download past invoices and receipts
 </p>
 </div>
 <Icon
 name="chevronRight"
 size="md"
 className="text-[var(--foreground-tertiary)] group-hover:text-[#00E5A0] dark:group-hover:text-[#00E5A0] transition"
 />
 </div>
 </Link>
 </div>

 {/* Cancel Confirmation Dialog */}
 <ConfirmDialog
 isOpen={isCancelDialogOpen}
 onClose={() => setIsCancelDialogOpen(false)}
 onConfirm={handleCancelSubscription}
 title="Cancel Subscription"
 message={`Are you sure you want to cancel your subscription? You will continue to have access until ${formatDate(subscription?.currentPeriodEnd || null)}. After that, your account will be downgraded to the Free plan.`}
 confirmText="Cancel Subscription"
 type="danger"
 />
 </div>
 );
}
