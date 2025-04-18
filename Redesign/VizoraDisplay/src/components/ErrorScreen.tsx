import React from 'react';

interface ErrorScreenProps {
  error: Error;
  onRetry?: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, onRetry }) => {
  return (
    <div className="error-screen-placeholder" style={{ padding: '20px', color: 'red' }}>
      <h1>Application Error</h1>
      <p>{error?.message || 'An unknown error occurred.'}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
};

export { ErrorScreen }; // Use named export as imported in DisplayApp 