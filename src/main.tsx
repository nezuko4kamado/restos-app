import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App.tsx";
import ContactUsDuplicate from "./pages/ContactUsDuplicate.tsx";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/contexts/AuthContext";
import "./index.css";

// Comprehensive ResizeObserver error suppression
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

const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';
  if (message.includes('ResizeObserver')) return;
  originalError.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';
  if (message.includes('ResizeObserver')) return;
  originalWarn.apply(console, args);
};

if (typeof ResizeObserver !== 'undefined') {
  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      let timeoutId: number | null = null;
      const debouncedCallback: ResizeObserverCallback = (entries, observer) => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          try {
            callback(entries, observer);
          } catch (e) {
            if (!(e instanceof Error && e.message.includes('ResizeObserver'))) throw e;
          }
        }, 0);
      };
      super(debouncedCallback);
    }
  };
}

/**
 * Render the application
 */
function renderApp(): void {
  // Check if URL contains hash routing (e.g., /#/contact)
  const isHashRoute = window.location.hash.startsWith('#/');

  createRoot(document.getElementById("root")!).render(
    isHashRoute ? (
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <LanguageProvider>
          <AuthProvider>
            <HashRouter>
              <Routes>
                <Route path="*" element={<ContactUsDuplicate />} />
              </Routes>
            </HashRouter>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    ) : (
      <App />
    )
  );
}

renderApp();