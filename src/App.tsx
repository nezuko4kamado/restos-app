import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { LanguageProvider } from '@/lib/i18n';
import { AuthProvider } from '@/contexts/AuthContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import UnifiedLoadingDialog from '@/components/UnifiedLoadingDialog';
import Login from '@/pages/Login';
import Index from '@/pages/Index';
import ContactUs from '@/pages/ContactUs';
import Dashboard from '@/pages/Dashboard';
import ResetPassword from '@/pages/ResetPassword';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <LanguageProvider>
        <AuthProvider>
          <LoadingProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Router>
            <UnifiedLoadingDialog />
            <Toaster />
          </LoadingProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;