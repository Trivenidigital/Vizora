import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './index.css'; // Import Tailwind base styles
import { DisplayProvider } from './context/DisplayContext'; // Assume we create this next
import AppContent from './AppContent'; // Assume we create this next
import ErrorBoundary from './components/ErrorBoundary'; // Assume we create this next

// Example simple logger for App.tsx
const logger = {
  info: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) console.log(`[App] ${message}`, ...args);
  },
  error: (message: string, error: any, ...args: any[]) => {
    console.error(`[App] ❌ ${message}`, error, ...args);
  },
};

function App() {
  logger.info('Initializing application...');

  return (
    <ErrorBoundary logger={logger}> 
      <Router>
        <DisplayProvider> 
            <AppContent />
        </DisplayProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
