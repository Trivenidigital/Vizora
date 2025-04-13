import React from 'react';
import { FiLoader } from 'react-icons/fi'; // Using react-icons

export interface LoadingSpinnerProps {
  message?: string;
  size?: number; // Size in pixels
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, size = 48 }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-4">
      <FiLoader 
        className="animate-spin text-blue-500" 
        size={size} 
        aria-label={message || 'Loading...'}
      />
      {message && <p className="mt-3 text-sm text-gray-400">{message}</p>}
    </div>
  );
}; 