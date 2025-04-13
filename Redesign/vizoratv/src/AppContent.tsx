import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// TEMP: Comment out ALL imports from DisplayContext
// import { useDisplay } from './context/DisplayContext'; 
import { PairingScreen } from './components/screens/PairingScreen';
import { DisplayScreen } from './components/screens/DisplayScreen';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Basic logger for AppContent
const logger = {
  info: (message: string, ...args: any[]) => console.log(`🔵 [AppContent] ${message}`, ...args),
};

const AppContent: React.FC = () => {
  // TEMP: Remove context usage entirely
  // const { isLoading, error } = useDisplay(); 
  const isLoading = true; // Keep loading indefinitely for this test
  const error = null;

  logger.info(`Rendering. isLoading: ${isLoading}`);

  if (isLoading) {
    logger.info('Showing Loading Spinner.');
    // Show a full-page loading spinner initially
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <LoadingSpinner message="Initializing Application..." />
      </div>
    );
  }

  // Could add more specific error handling here if needed
  // if (error) { ... }
  
  logger.info('Initialization complete. Rendering AppRoutes.');

  return (
    <Routes>
      {/* Default route could be PairingScreen or based on state */}
      <Route path="/pair" element={<PairingScreen />} />
      <Route path="/display" element={<DisplayScreen />} />
      {/* Redirect root to pairing screen for now */}
      <Route path="*" element={<Navigate to="/pair" replace />} />
    </Routes>
  );
};

export default AppContent; 