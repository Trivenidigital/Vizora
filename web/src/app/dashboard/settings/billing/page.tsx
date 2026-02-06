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

 useEffect(() => {
 loadBillingData();
 }, []);

 const loadBillingData = async () => {
 try {
 setLoading(true);
 const [subData, quotaData] = await Promise.all([
 apiClient.getSubscriptionStatus(),
 apiClient.getQuotaUsage(),
 ]);
 setSubscription(subData);
 setQuota(quotaData);
 } catch (error: any) {
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

 const formatDate = (dateStr: string | null) => {
 if (!dateStr) return 'N/A';
 return new Date(dateStr).toLocaleDateString('en-US', {
 month: 'long',
 day: 'numeric',
 year: 'numeric',
 });
 };

 const isTrialing = subscription?.subscriptionStatus === 'trialing';
 const isCanceled = subscription?.cancelAtPeriodEnd;
 const isPaidPlan = subscription?.subscriptionTier !== 'free' && subscription?.subscriptionTier !== 'Free';

 if (loading) {
 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-3xl font-bold text-[var(--foreground)]">Billing</h2>
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
 <h2 className="text-3xl font-bold text-[var(--foreground)]">Billing</h2>
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
 <StatusBadge status={subscription?.subscriptionStatus || 'free'} />
 </div>
 </div>

 <div className="p-6">
 <div className="flex items-start justify-between mb-6">
 <div>
 <div className="text-3xl font-bold text-[var(--foreground)] capitalize">
 {subscription?.subscriptionTier || 'Free'}
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

 {isCanceled ? (
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

 {/* Payment Provider Info */}
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
