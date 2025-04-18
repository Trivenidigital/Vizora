// Keep React commented out as it's unused
// import React from 'react';
// import { DisplayProvider } from './context/DisplayContext';
// import './App.css';
// import AppContent from './AppContent';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PairingScreen } from './components/screens/PairingScreen';
import { DisplayScreen } from './components/screens/DisplayScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/pair" element={<PairingScreen />} />
        <Route path="/display" element={<DisplayScreen />} />
        <Route path="*" element={<Navigate to="/pair" replace />} />
      </Routes>
    </Router>
    // <DisplayProvider>
    //   <ErrorBoundary>
    //     <AppContent />
    //     {/* {import.meta.env.DEV && <ConnectionDebugOverlay />} */}
    //   </ErrorBoundary>
    // </DisplayProvider>
  );
}

export default App;
