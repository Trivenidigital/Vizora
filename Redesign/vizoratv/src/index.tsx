// Enable service worker registration in production
// Use Vite env var
if ('serviceWorker' in navigator && import.meta.env.PROD) { 
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
// Use Vite env var
if (import.meta.env.PROD) { 
  document.addEventListener('contextmenu', event => event.preventDefault());
} 