import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DisplayProvider, useDisplay } from './contexts/DisplayContext';
import PairingScreen from './pages/PairingScreen';
import RegisterDisplay from './pages/RegisterDisplay';
import DisplayScreen from './pages/DisplayScreen';
import NotFound from './pages/NotFound';
import './App.css';

// Router component that conditionally renders routes based on display state
const AppRoutes: React.FC = () => {
  const { 
    isLoading, 
    needsRegistration, 
    needsPairing, 
    isPaired, 
    isRegistered, 
    error, 
    resetError 
  } = useDisplay();

  // Log current app state (useful for debugging)
  useEffect(() => {
    console.log('🧭 App Routing State:', {
      isLoading,
      needsRegistration,
      needsPairing,
      isPaired,
      isRegistered,
      hasError: !!error
    });
  }, [isLoading, needsRegistration, needsPairing, isPaired, isRegistered, error]);

  // Show global error if it exists
  if (error) {
    return (
      <div className="global-error">
        <div className="error-content">
          <strong>Error:</strong> {error}
        </div>
        <button onClick={resetError} className="dismiss-button">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <Routes>
      {/* Home route - conditionally redirect based on state */}
      <Route 
        path="/" 
        element={
          isLoading ? (
            <div className="loading-screen">
              <h1>Vizora TV</h1>
              <div className="loader"></div>
              <p>Initializing display...</p>
            </div>
          ) : needsPairing ? (
            <PairingScreen />
          ) : needsRegistration ? (
            <Navigate to="/register" replace />
          ) : isRegistered || isPaired ? (
            <DisplayScreen />
          ) : (
            <PairingScreen />
          )
        } 
      />

      {/* Registration route - only accessible when needed */}
      <Route 
        path="/register" 
        element={
          needsRegistration ? <RegisterDisplay /> : <Navigate to="/" replace />
        } 
      />

      {/* Explicit routes for these screens */}
      <Route path="/pairing" element={<PairingScreen />} />
      <Route path="/display" element={<DisplayScreen />} />
      
      {/* Fallback route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <div className="app">
      <DisplayProvider>
        <Router>
          <AppRoutes />
        </Router>
      </DisplayProvider>
    </div>
  );
}

export default App; 