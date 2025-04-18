import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  iconOnly?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ iconOnly = false, ...props }) => {
  // Placeholder SVG - Replace with actual Vizora logo later
  return (
    <div className="flex items-center gap-2" aria-label="Vizora Logo">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="h-8 w-8 text-primary" 
        {...props}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      {!iconOnly && (
        <span className="text-2xl font-bold text-white tracking-tight">
          Vizora
        </span>
      )}
    </div>
  );
}; 