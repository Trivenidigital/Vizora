'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  items,
  allowMultiple = false,
  defaultOpen = [],
  className,
}) => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen));

  const toggleItem = (id: string) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      if (!allowMultiple) {
        newOpen.clear();
      }
      newOpen.add(id);
    }
    setOpenItems(newOpen);
  };

  return (
    <div className={`space-y-2 ${className || ''}`}>
      {items.map((item) => {
        const isOpen = openItems.has(item.id);
        return (
          <div
            key={item.id}
            className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full px-4 py-3 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left font-medium text-neutral-900 dark:text-neutral-50"
              aria-expanded={isOpen}
              aria-controls={`content-${item.id}`}
            >
              {item.title}
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOpen && (
              <div
                id={`content-${item.id}`}
                className="px-4 py-3 bg-[var(--surface)] border-t border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
