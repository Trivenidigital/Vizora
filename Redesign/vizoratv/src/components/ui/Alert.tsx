import React from 'react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
  children: React.ReactNode;
}

interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode;
}

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  // Basic styling
  const baseStyle = 'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11';

  const variantStyles = {
    default: 'bg-background text-foreground border-border', // Adapt these variables if needed
    destructive: 'border-red-700/50 text-red-200 dark:border-red-700 [&>svg]:text-red-300 bg-red-900', // Style from PairingScreen
  };

  return (
    <div
      role="alert"
      className={`${baseStyle} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const AlertTitle: React.FC<AlertTitleProps> = ({ className = '', children, ...props }) => (
  <h5
    className={`mb-1 font-medium leading-none tracking-tight ${className}`}
    {...props}
  >
    {children}
  </h5>
);

export const AlertDescription: React.FC<AlertDescriptionProps> = ({ className = '', children, ...props }) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className}`} {...props}>
    {children}
  </div>
);

// Note: Assumes TailwindCSS setup provides 'background', 'foreground', 'border' variables or uses default colors.
// Adjust styles as needed for the TV appearance.