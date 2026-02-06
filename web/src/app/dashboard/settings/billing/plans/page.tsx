'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import type { Plan } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';
import { PlanCard } from '../components/plan-card';

export default function PlansPage() {
 const router = useRouter();
 const toast = useToast();
 const [plans, setPlans] = useState<Plan[]>([]);
 const [loading, setLoading] = useState(true);
 const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
 const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

 useEffect(() => {
 loadPlans();
 }, []);

 const loadPlans = async () => {
 try {
 setLoading(true);
 const planData = await apiClient.getPlans();
 setPlans(planData);
 } catch (error: any) {
 toast.error(error.message || 'Failed to load plans');
 } finally {
 setLoading(false);
 }
 };

 const handleSelectPlan = async (plan: Plan) => {
 if (plan.isCurrent || plan.name.toLowerCase() === 'enterprise') {
 return;
 }

 try {
 setCheckoutLoading(plan.id);
 const { url } = await apiClient.createCheckout(plan.id, billingInterval);
 window.location.href = url;
 } catch (error: any) {
 toast.error(error.message || 'Failed to start checkout');
 setCheckoutLoading(null);
 }
 };

 // Calculate yearly savings
 const getYearlySavings = (plan: Plan) => {
 if (plan.interval !== 'monthly' || plan.price === 0) return 0;
 // Assuming 20% discount for yearly
 return Math.round(plan.price * 12 * 0.2);
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
 <h2 className="text-3xl font-bold text-[var(--foreground)]">Choose a Plan</h2>
 <p className="mt-1 text-[var(--foreground-secondary)]">
 Select the plan that best fits your needs
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
 <h2 className="text-3xl font-bold text-[var(--foreground)]">Choose a Plan</h2>
 <p className="mt-1 text-[var(--foreground-secondary)]">
 Select the plan that best fits your needs
 </p>
 </div>
 </div>

 {/* Billing Interval Toggle */}
 <div className="flex justify-center">
 <div className="inline-flex items-center bg-[var(--background-secondary)] rounded-lg p-1">
 <button
 onClick={() => setBillingInterval('monthly')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition ${
 billingInterval === 'monthly'
 ? 'bg-[var(--surface)] text-[var(--foreground)] shadow'
 : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
 }`}
 >
 Monthly
 </button>
 <button
 onClick={() => setBillingInterval('yearly')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition flex items-center gap-2 ${
 billingInterval === 'yearly'
 ? 'bg-[var(--surface)] text-[var(--foreground)] shadow'
 : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
 }`}
 >
 Yearly
 <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
 Save 20%
 </span>
 </button>
 </div>
 </div>

 {/* Plans Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {plans.map((plan) => {
 // Adjust price for yearly billing
 const displayPlan = {
 ...plan,
 price:
 billingInterval === 'yearly' && plan.price > 0
 ? Math.round(plan.price * 12 * 0.8) // 20% discount
 : plan.price,
 interval: billingInterval,
 };

 return (
 <PlanCard
 key={plan.id}
 plan={displayPlan}
 onSelect={() => handleSelectPlan(plan)}
 isCurrentPlan={plan.isCurrent}
 isLoading={checkoutLoading === plan.id}
 />
 );
 })}
 </div>

 {/* FAQ Section */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 mt-8">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
 Frequently Asked Questions
 </h3>
 <div className="space-y-4">
 <div>
 <h4 className="font-medium text-[var(--foreground)]">Can I change plans later?</h4>
 <p className="text-sm text-[var(--foreground-secondary)] mt-1">
 Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately,
 and we&apos;ll prorate the difference.
 </p>
 </div>
 <div>
 <h4 className="font-medium text-[var(--foreground)]">What happens if I exceed my screen quota?</h4>
 <p className="text-sm text-[var(--foreground-secondary)] mt-1">
 You won&apos;t be able to add new screens until you upgrade to a higher plan or remove
 existing screens.
 </p>
 </div>
 <div>
 <h4 className="font-medium text-[var(--foreground)]">Is there a contract or commitment?</h4>
 <p className="text-sm text-[var(--foreground-secondary)] mt-1">
 No, all plans are pay-as-you-go with no long-term contracts. You can cancel at any time.
 </p>
 </div>
 <div>
 <h4 className="font-medium text-[var(--foreground)]">Do you offer refunds?</h4>
 <p className="text-sm text-[var(--foreground-secondary)] mt-1">
 We offer a 14-day money-back guarantee for new subscriptions. Contact support for assistance.
 </p>
 </div>
 </div>
 </div>

 {/* Pricing Info */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
 Per-Screen Pricing
 </h3>
 <div className="grid md:grid-cols-3 gap-4 text-sm">
 <div className="p-4 bg-[var(--background)] rounded-lg">
 <div className="font-semibold text-[var(--foreground)]">Free Trial</div>
 <div className="text-[var(--foreground-secondary)]">5 screens free for 30 days</div>
 </div>
 <div className="p-4 bg-[var(--background)] rounded-lg">
 <div className="font-semibold text-[var(--foreground)]">Basic: $6/screen/mo</div>
 <div className="text-[var(--foreground-secondary)]">Up to 50 screens</div>
 </div>
 <div className="p-4 bg-[var(--background)] rounded-lg">
 <div className="font-semibold text-[var(--foreground)]">Pro: $8/screen/mo</div>
 <div className="text-[var(--foreground-secondary)]">Up to 100 screens</div>
 </div>
 </div>
 </div>

 {/* Enterprise CTA */}
 <div className="bg-gradient-to-r from-[#00E5A0] to-[#00B4D8] rounded-lg p-6 text-white">
 <div className="flex flex-col md:flex-row items-center justify-between gap-4">
 <div>
 <h3 className="text-xl font-bold">Need more than 100 screens?</h3>
 <p className="text-[#00E5A0]/50 mt-1">
 Contact our sales team for custom enterprise pricing and dedicated support.
 </p>
 </div>
 <a
 href="mailto:sales@vizora.io?subject=Enterprise%20Plan%20Inquiry"
 className="px-6 py-3 bg-[var(--surface)] text-[#00E5A0] font-semibold rounded-lg hover:bg-[#00E5A0]/5 transition whitespace-nowrap"
 >
 Contact Sales
 </a>
 </div>
 </div>
 </div>
 );
}
