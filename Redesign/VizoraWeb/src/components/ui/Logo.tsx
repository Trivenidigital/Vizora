import { FC } from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'white';
}

const Logo: FC<LogoProps> = ({ className = '', variant = 'default' }) => {
  const colorClass = variant === 'white' ? 'text-white' : 'text-purple-600';

  return (
    <div className={`flex items-center ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mr-2"
      >
        <rect
          width="120"
          height="120"
          rx="24"
          fill={variant === 'white' ? 'white' : 'currentColor'}
          className={variant === 'white' ? 'opacity-90' : 'text-purple-600'}
        />
        <path
          d="M42.5 30H77.5L58.75 60H77.5L42.5 90L61.25 60H42.5L61.25 30H42.5Z"
          fill={variant === 'white' ? '#6D28D9' : 'white'}
        />
      </svg>

      <span className={`font-bold text-xl ${colorClass}`}>
        Vizora
      </span>
    </div>
  );
};

export default Logo; 