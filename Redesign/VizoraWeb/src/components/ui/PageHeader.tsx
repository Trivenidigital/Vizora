import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title,
  subtitle,
  children,
  className
}) => {
  return (
    <div className={cn("pb-5 border-b border-gray-200 sm:flex sm:items-center sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {children && <div className="mt-3 sm:mt-0">{children}</div>}
    </div>
  );
};

export default PageHeader; 