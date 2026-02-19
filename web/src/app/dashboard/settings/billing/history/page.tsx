'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { Invoice } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { StatusBadge } from '../components/status-badge';

export default function InvoiceHistoryPage() {
 const toast = useToast();
 const [invoices, setInvoices] = useState<Invoice[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 loadInvoices();
 }, []);

 const loadInvoices = async () => {
 try {
 setLoading(true);
 const data = await apiClient.getInvoices();
 setInvoices(data);
 } catch (error: any) {
 toast.error(error.message || 'Failed to load invoices');
 } finally {
 setLoading(false);
 }
 };

 const formatDate = (dateStr: string) => {
 return new Date(dateStr).toLocaleDateString('en-US', {
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 });
 };

 const formatAmount = (amount: number, currency: string) => {
 if (currency === 'INR') {
 return new Intl.NumberFormat('en-IN', {
 style: 'currency',
 currency: 'INR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0,
 }).format(amount / 100); // Amount is in paise
 }
 return new Intl.NumberFormat('en-US', {
 style: 'currency',
 currency: currency,
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 }).format(amount / 100); // Amount is in cents
 };

 if (loading) {
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <Link
 href="/dashboard/settings/billing"
 className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition"
 >
 <Icon name="chevronLeft" size="lg" className="text-[var(--foreground-secondary)]" />
 </Link>
 <div>
 <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Invoice History</h2>
 <p className="mt-1 text-[var(--foreground-secondary)]">
 View and download your past invoices
 </p>
 </div>
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

 <div className="flex items-center gap-4">
 <Link
 href="/dashboard/settings/billing"
 className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition"
 >
 <Icon name="chevronLeft" size="lg" className="text-[var(--foreground-secondary)]" />
 </Link>
 <div>
 <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Invoice History</h2>
 <p className="mt-1 text-[var(--foreground-secondary)]">
 View and download your past invoices
 </p>
 </div>
 </div>

 {invoices.length === 0 ? (
 <EmptyState
 icon="document"
 title="No invoices yet"
 description="Your invoice history will appear here once you have an active subscription"
 />
 ) : (
 <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
 <table className="min-w-full divide-y divide-[var(--border)]">
 <thead className="bg-[var(--background)]">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Date
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Description
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Amount
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Status
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Invoice
 </th>
 </tr>
 </thead>
 <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
 {invoices.map((invoice) => (
 <tr key={invoice.id} className="hover:bg-[var(--surface-hover)] transition">
 <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground)]">
 {formatDate(invoice.createdAt)}
 </td>
 <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
 {invoice.description || 'Subscription payment'}
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">
 {formatAmount(invoice.amount, invoice.currency)}
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <StatusBadge status={invoice.status} />
 </td>
 <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
 {invoice.pdfUrl ? (
 <a
 href={invoice.pdfUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-[#00E5A0] hover:text-[#00E5A0] dark:text-[#00E5A0] dark:hover:text-[#00CC8E] font-medium inline-flex items-center gap-1"
 >
 <Icon name="download" size="sm" />
 Download
 </a>
 ) : (
 <span className="text-[var(--foreground-tertiary)]">N/A</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Help Text */}
 <div className="bg-[var(--background)] rounded-lg p-4">
 <div className="flex items-start gap-3">
 <Icon name="info" size="lg" className="text-[var(--foreground-tertiary)] flex-shrink-0 mt-0.5" />
 <div>
 <p className="text-sm text-[var(--foreground-secondary)]">
 Need a copy of an invoice for accounting purposes? You can download any invoice as a PDF
 using the download link. For any billing questions, please contact{' '}
 <a
 href="mailto:billing@vizora.io"
 className="text-[#00E5A0] hover:text-[#00E5A0] dark:text-[#00E5A0] dark:hover:text-[#00CC8E]"
 >
 billing@vizora.io
 </a>
 .
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
