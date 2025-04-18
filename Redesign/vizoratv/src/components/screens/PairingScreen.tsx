import React from 'react';
// Import necessary hooks/context if needed for minimal rendering, 
// but remove most conditional logic imports for now.
// import { useDisplay } from '@/context/DisplayContext';
// import { useConnectionState } from '@vizora/common/hooks/useConnectionState';
// ... other imports related to state can be removed for this test ...

export const PairingScreen: React.FC = () => {
  // Temporarily remove all state logic and conditional rendering

  return (
    // Only the outermost div with the background gradient and a simple heading
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-white bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0ea5e9]">
      <h1 className="text-4xl font-bold">Styling Test</h1>
      <p className="mt-4 text-lg">If you see this text on a blue gradient background, Tailwind is working.</p>
    </div>
  );
};

export default PairingScreen; 