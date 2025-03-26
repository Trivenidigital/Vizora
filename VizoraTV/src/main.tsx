import React from 'react'
import ReactDOM from 'react-dom/client'
import { 
  createBrowserRouter, 
  RouterProvider,
  Navigate
} from 'react-router-dom'
import App from './App.tsx'
import ContentDisplay from './components/ContentDisplay.tsx'
import './index.css'

// DO NOT clear localStorage on startup - we need to preserve pairing information
console.log('main.tsx: Application startup - preserving localStorage data');

// Only clear localStorage if explicitly requested
const urlParams = new URLSearchParams(window.location.search);
const forceReset = urlParams.get('reset') !== null || urlParams.get('clear') !== null;
const hasDisplayId = urlParams.get('displayId') !== null;

// Only redirect if explicitly requested with reset/clear parameter
if (forceReset) {
  console.log('main.tsx: Force reset detected, clearing localStorage');
  localStorage.clear();
  // Use a timestamp to bust cache
  const timestamp = Date.now();
  window.location.href = `/?timestamp=${timestamp}`;
} 
// Only redirect for content-display without displayId
else if (window.location.pathname === '/content-display' && !hasDisplayId) {
  console.log('main.tsx: Content display without displayId, redirecting to root');
  window.location.href = `/?timestamp=${Date.now()}`;
}

// Hide cursor after inactivity for TV displays
let cursorTimeout: number | null = null;

const resetCursorTimeout = () => {
  if (cursorTimeout) {
    window.clearTimeout(cursorTimeout);
  }
  document.body.classList.remove('inactive-cursor');
  
  cursorTimeout = window.setTimeout(() => {
    document.body.classList.add('inactive-cursor');
  }, 5000); // Hide cursor after 5 seconds of inactivity
};

// Add event listeners to reset the cursor timeout
window.addEventListener('mousemove', resetCursorTimeout);
window.addEventListener('mousedown', resetCursorTimeout);
window.addEventListener('keypress', resetCursorTimeout);
window.addEventListener('touchstart', resetCursorTimeout);

// Initial call to start the timeout
resetCursorTimeout();

// Create router with explicit routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />
  },
  {
    path: '/content-display',
    element: <ContentDisplay />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
) 