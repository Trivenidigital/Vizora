'use client';

import type { Plan } from '@/lib/types';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';

interface PlanCardProps {
  plan: Plan;
  onSelect: () => void;
  onContactSales?: () => void;
  isCurrentPlan: boolean;
  isLoading?: boolean;
}

export function PlanCard({ plan, onSelect, onContactSales, isCurrentPlan, isLoading }: PlanCardProps) {
  const formatPrice = (priceInSmallestUnit: number, currency: string) => {
    const price = priceInSmallestUnit / 100; // cents/paise → dollars/rupees
    if (currency === 'INR' || currency === 'inr') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const isEnterprise = plan.name.toLowerCase() === 'enterprise';
  const isFree = plan.price === 0;

  return (
    <div
      className={`relative flex flex-col bg-[var(--surface)] rounded-xl border-2 transition-all ${
        isCurrentPlan
          ? 'border-[#00E5A0] shadow-lg ring-2 ring-[#00E5A0]/30'
          : 'border-[var(--border)] hover:border-[var(--border-dark)]'
      }`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#00E5A0] text-[#061A21] text-xs font-semibold px-3 py-1 rounded-full">
            Current Plan
          </span>
        </div>
      )}

      <div className="p-6 flex-1">
        <h3 className="text-xl font-bold text-[var(--foreground)]">{plan.name}</h3>

        <div className="mt-4">
          {isEnterprise ? (
            <div className="text-2xl font-bold text-[var(--foreground)]">Custom</div>
          ) : (
            <>
              <span className="text-3xl font-bold text-[var(--foreground)]">
                {isFree ? 'Free' : formatPrice(plan.price, plan.currency)}
              </span>
              {!isFree && (
                <span className="text-[var(--foreground-tertiary)] text-sm">
                  /{plan.interval === 'yearly' ? 'year' : 'month'}
                </span>
              )}
            </>
          )}
        </div>

        <div className="mt-4 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)]">
            <Icon name="devices" size="sm" className="text-[var(--foreground-tertiary)]" />
            <span>
              {isEnterprise
                ? 'Unlimited screens'
                : `Up to ${plan.screenQuota} screen${plan.screenQuota !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-[var(--foreground-secondary)]">
              <Icon name="check" size="sm" className="text-green-500 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-6 pt-0">
        {isEnterprise ? (
          <button
            onClick={onContactSales}
            className="w-full py-3 px-4 bg-[var(--surface-hover)] text-[var(--foreground)] font-semibold rounded-lg hover:bg-[var(--border)] transition"
          >
            Contact Sales
          </button>
        ) : isCurrentPlan ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-[var(--surface-hover)] text-[var(--foreground-tertiary)] font-semibold rounded-lg cursor-not-allowed"
          >
            Current Plan
          </button>
        ) : (
          <button
            onClick={onSelect}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#00E5A0] text-[#061A21] font-semibold rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                Processing...
              </>
            ) : isFree ? (
              'Downgrade'
            ) : (
              'Select Plan'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
