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
    className={`bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow ${
      className || ''
    }`}
  >
    {children}
  </div>
);

const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => (
  <div
    className={`px-6 py-4 border-b border-[var(--border)] ${
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
    className={`px-6 py-3 border-t border-[var(--border)] bg-[var(--background)] rounded-b-lg ${
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
