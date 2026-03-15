import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Comprehensive ResizeObserver error suppression
// This error is harmless and occurs when ResizeObserver callbacks take longer than one animation frame

// Method 1: Intercept at window level
const errorHandler = (event: ErrorEvent) => {
  const errorMessage = event.message || '';
  if (
    errorMessage.includes('ResizeObserver') ||
    errorMessage === 'ResizeObserver loop completed with undelivered notifications.' ||
    errorMessage === 'ResizeObserver loop limit exceeded'
  ) {
    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();
    return false;
  }
};

window.addEventListener('error', errorHandler, true);

// Method 2: Override console methods
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';
  if (message.includes('ResizeObserver')) {
    return;
  }
  originalError.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';
  if (message.includes('ResizeObserver')) {
    return;
  }
  originalWarn.apply(console, args);
};

// Method 3: Debounce ResizeObserver if it exists
if (typeof ResizeObserver !== 'undefined') {
  const OriginalResizeObserver = window.ResizeObserver;
  
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      let timeoutId: number | null = null;
      
      const debouncedCallback: ResizeObserverCallback = (entries, observer) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        
        timeoutId = window.setTimeout(() => {
          try {
            callback(entries, observer);
          } catch (e) {
            // Silently catch ResizeObserver errors
            if (!(e instanceof Error && e.message.includes('ResizeObserver'))) {
              throw e;
            }
          }
        }, 0);
      };
      
      super(debouncedCallback);
    }
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);