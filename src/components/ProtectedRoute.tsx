import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** Maximum time to show the loading spinner before giving up */
const MAX_LOADING_MS = 5000;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDemoMode } = useAuth();
  const [forceReady, setForceReady] = useState(false);

  // CRITICAL FIX: Safety net - if loading is stuck for too long, force-resolve
  useEffect(() => {
    if (!loading) {
      // Loading already resolved, nothing to do
      return;
    }

    const timer = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ [ProtectedRoute] Loading stuck for', MAX_LOADING_MS, 'ms, forcing ready state');
        setForceReady(true);
      }
    }, MAX_LOADING_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  // Show spinner only if auth is still loading AND we haven't hit the safety timeout
  if (loading && !forceReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Allow access if user is authenticated OR in demo mode
  if (!user && !isDemoMode) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;