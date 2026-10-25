import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Landing from '@/pages/Landing';

/**
 * Public entry point on `/`.
 * Visitors see the landing page; users already logged in (or in demo mode)
 * go straight to the app, so PWA/TWA launches never get stuck on the landing.
 */
export function PublicLanding() {
  const { user, isDemoMode, loading } = useAuth();

  if (user || isDemoMode) {
    return <Navigate to="/app" replace />;
  }

  // Avoid flashing the landing to logged-in users while the session is restored.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return <Landing />;
}

export default PublicLanding;
