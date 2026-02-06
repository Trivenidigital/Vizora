'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { IconName } from '@/theme/icons';
import { Icon } from '@/theme/icons';

interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  variant?: 'underline' | 'pills' | 'bordered';
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  variant = 'underline',
  onTabChange,
  className,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const baseTabClass =
    'relative px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5A0]';
  const inactiveClass =
    'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]';
  const activeClass =
    'text-primary-600 dark:text-primary-400';

  const tabListClass = {
    underline: 'border-b border-[var(--border)] flex gap-0',
    pills: 'flex gap-2 p-1 bg-[var(--surface-hover)] rounded-lg',
    bordered: 'flex gap-2 border border-[var(--border)] rounded-lg p-1',
  };

  const underlineIndicator = activeTab && (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-600 dark:bg-primary-400 transition-all" />
  );

  return (
    <div className={className}>
      <div className={`${tabListClass[variant]}`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => handleTabClick(tab.id)}
            className={`${baseTabClass} ${
              activeTab === tab.id
                ? `${activeClass} ${variant === 'pills' ? 'bg-[var(--surface)] rounded' : ''}`
                : inactiveClass
            } ${variant === 'underline' ? 'relative' : ''}`}
          >
            {tab.icon && <Icon name={tab.icon} className="inline mr-2 w-4 h-4" />}
            {tab.label}
            {variant === 'underline' && activeTab === tab.id && underlineIndicator}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={tab.id}
            hidden={activeTab !== tab.id}
          >
            {activeTab === tab.id && tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};
