'use client';

import type { Plan } from '@/lib/types';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';

interface PlanCardProps {
  plan: Plan;
  onSelect: () => void;
  isCurrentPlan: boolean;
  isLoading?: boolean;
}

export function PlanCard({ plan, onSelect, isCurrentPlan, isLoading }: PlanCardProps) {
  const formatPrice = (price: number, currency: string) => {
    if (currency === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const isEnterprise = plan.name.toLowerCase() === 'enterprise';
  const isFree = plan.price === 0;

  return (
    <div
      className={`relative flex flex-col bg-white dark:bg-gray-900 rounded-xl border-2 transition-all ${
        isCurrentPlan
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Current Plan
          </span>
        </div>
      )}

      <div className="p-6 flex-1">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50">{plan.name}</h3>

        <div className="mt-4">
          {isEnterprise ? (
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">Custom</div>
          ) : (
            <>
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                {isFree ? 'Free' : formatPrice(plan.price, plan.currency)}
              </span>
              {!isFree && (
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  /{plan.interval === 'yearly' ? 'year' : 'month'}
                </span>
              )}
            </>
          )}
        </div>

        <div className="mt-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Icon name="devices" size="sm" className="text-gray-400" />
            <span>
              {isEnterprise
                ? 'Unlimited screens'
                : `Up to ${plan.screenQuota} screen${plan.screenQuota !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Icon name="check" size="sm" className="text-green-500 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-6 pt-0">
        {isEnterprise ? (
          <a
            href="mailto:sales@vizora.io?subject=Enterprise%20Plan%20Inquiry"
            className="block w-full text-center py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Contact Sales
          </a>
        ) : isCurrentPlan ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold rounded-lg cursor-not-allowed"
          >
            Current Plan
          </button>
        ) : (
          <button
            onClick={onSelect}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
