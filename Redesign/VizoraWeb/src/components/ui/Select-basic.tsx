import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  fullWidth = true,
  className = '',
  children,
  ...props
}) => {
  const id = props.id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`mb-4 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <select
        id={id}
        className={`
          w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm 
          text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 
          focus:border-violet-500 appearance-none bg-white
          ${error ? 'border-red-500' : ''} 
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Select; 