'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

const CardRoot: React.FC<CardProps> = ({ children, className }) => (
  <div
    className={`bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow ${
      className || ''
    }`}
  >
    {children}
  </div>
);

const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => (
  <div
    className={`px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 ${
      className || ''
    }`}
  >
    {children}
  </div>
);

const CardBody: React.FC<CardBodyProps> = ({ children, className }) => (
  <div className={`px-6 py-4 ${className || ''}`}>{children}</div>
);

const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => (
  <div
    className={`px-6 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 rounded-b-lg ${
      className || ''
    }`}
  >
    {children}
  </div>
);

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
