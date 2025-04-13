import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface TagProps {
  text: string;
  color?: 'default' | 'blue' | 'green' | 'red' | 'purple' | 'yellow';
  onDelete?: () => void;
  disabled?: boolean;
}

const Tag: React.FC<TagProps> = ({ text, color = 'default', onDelete, disabled = false }) => {
  const colorClasses = {
    default: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    yellow: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}
    >
      {text}
      {onDelete && (
        <button 
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className={`ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'
          }`}
        >
          <span className="sr-only">Remove tag</span>
          <XMarkIcon className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
};

export { Tag }; 