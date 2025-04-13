import React, { useMemo } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';

interface UserAvatarProps {
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    image?: string;
  } | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 'md',
  className = '' 
}) => {
  // Size classes based on the size prop
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };

  // Generate user initials from name or email
  const initials = useMemo(() => {
    if (!user) return 'U';

    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
    }

    if (user.firstName) {
      return user.firstName.charAt(0);
    }

    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }

    return 'U';
  }, [user]);

  // If user has an image, display it
  if (user?.image) {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden ${className}`}>
        <img 
          src={user.image} 
          alt={`${user.firstName || 'User'}'s avatar`} 
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // Otherwise display initials or default icon
  return (
    <div 
      className={`${sizeClasses[size]} flex items-center justify-center rounded-full ${
        user ? 'bg-gradient-to-br from-[#0061A8] to-[#00C2BA] text-white' : 'bg-gray-200 text-gray-500'
      } ${className}`}
    >
      {user ? (
        <span className="font-medium">{initials}</span>
      ) : (
        <UserCircleIcon className="h-full w-full" />
      )}
    </div>
  );
};

export default UserAvatar; 