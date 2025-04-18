import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Keep React commented out as it's unused
// import React from 'react';
// import { DisplayProvider } from './context/DisplayContext';
import './App.css';
// import AppContent from './AppContent';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PairingScreen } from './components/screens/PairingScreen';
import { DisplayScreen } from './components/screens/DisplayScreen';
function App() {
    return (_jsx(Router, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/pair", element: _jsx(PairingScreen, {}) }), _jsx(Route, { path: "/display", element: _jsx(DisplayScreen, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/pair", replace: true }) })] }) })
    // <DisplayProvider>
    //   <ErrorBoundary>
    //     <AppContent />
    //     {/* {import.meta.env.DEV && <ConnectionDebugOverlay />} */}
    //   </ErrorBoundary>
    // </DisplayProvider>
    );
}
export default App;
