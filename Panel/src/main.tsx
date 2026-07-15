import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Patch fetch globally to bypass ngrok browser warning pages for API requests
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  const url = typeof input === 'string' ? input : (input as any).url || '';
  if (url.includes('ngrok-free.dev') || url.includes('ngrok-free.app')) {
    const headers = new Headers(init?.headers || {});
    headers.set('ngrok-skip-browser-warning', 'true');
    return originalFetch(input, {
      ...init,
      headers
    });
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
