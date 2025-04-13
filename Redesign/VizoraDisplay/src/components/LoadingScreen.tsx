import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Loading..." }) => {
  return (
    <div className="loading-screen" data-testid="loading-screen">
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
}; 