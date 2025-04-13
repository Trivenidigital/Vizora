import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Enable service worker registration in production
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Disable context menu in production to prevent tampering
if (process.env.NODE_ENV === 'production') {
  document.addEventListener('contextmenu', event => event.preventDefault());
}

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 