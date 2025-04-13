import React from 'react';

interface ProgressBarProps {
  progress: number;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  height?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  variant = 'primary', 
  height = 'md',
  animated = true
}) => {
  // Sanitize progress value
  const sanitizedProgress = Math.min(Math.max(0, progress), 100);
  
  // Variant classes
  const variantClasses = {
    primary: 'bg-indigo-600',
    secondary: 'bg-purple-600',
    success: 'bg-green-600',
    danger: 'bg-red-600'
  };
  
  // Height classes
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-4'
  };
  
  return (
    <div className="w-full bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={`${variantClasses[variant]} ${heightClasses[height]} ${
          animated ? 'transition-all duration-300 ease-out' : ''
        }`}
        style={{ width: `${sanitizedProgress}%` }}
        role="progressbar"
        aria-valuenow={sanitizedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
};

export { ProgressBar }; 