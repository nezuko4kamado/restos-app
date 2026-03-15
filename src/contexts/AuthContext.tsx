import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  isDemoMode: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Ensures a user_subscriptions record exists for the given user.
 * ✅ SAFE: Uses INSERT (never upsert) to prevent overwriting existing premium/paid records.
 */
async function ensureSubscriptionRecord(userId: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return; // Record exists - NEVER overwrite
    }

    // Only insert if truly no record exists
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { error: insertError } = await supabase.from('user_subscriptions').insert({
      user_id: userId,
      subscription_type: 'free',
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: endOfMonth.toISOString(),
      scans_limit: 10,
      products_limit: 20,
      invoices_limit: 10,
      scans_used: 0,
      products_saved: 0,
      invoices_this_month: 0,
    });

    if (insertError) {
      // Duplicate key = record already exists (race condition), that's fine
      if (insertError.code === '23505') {
        console.log('ℹ️ [AUTH] Subscription record already exists (concurrent insert)');
        return;
      }
      console.warn('⚠️ [AUTH] Could not create subscription record:', insertError.message);
      return;
    }

    console.log('🟢 [AUTH] Created fallback subscription record for user:', userId);
  } catch (err) {
    console.warn('⚠️ [AUTH] Could not ensure subscription record:', err);
  }
}

/** Maximum time to wait for auth initialization before showing the app */
const AUTH_TIMEOUT_MS = 3000;

/** Fake user object for demo mode */
const DEMO_USER: User = {
  id: 'demo-user-000',
  email: 'demo@restos.app',
  app_metadata: {},
  user_metadata: { full_name: 'Demo User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // CRITICAL FIX: Track if signOut is in progress to prevent auth listener from conflicting
  const isSigningOutRef = useRef(false);
  // Track if loading has been set to false at least once
  const loadingResolvedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ [AUTH] Supabase not configured, skipping auth init');
      setLoading(false);
      loadingResolvedRef.current = true;
      return;
    }

    let isMounted = true;

    const forceStopLoading = () => {
      if (isMounted && !loadingResolvedRef.current) {
        console.warn('⚠️ [AUTH] Force-stopping loading state');
        loadingResolvedRef.current = true;
        setLoading(false);
      }
    };

    // CRITICAL FIX: Primary timeout - reduced to 3s for better UX
    const primaryTimeout = setTimeout(() => {
      if (isMounted && !loadingResolvedRef.current) {
        console.warn('⚠️ [AUTH] Auth initialization timed out after', AUTH_TIMEOUT_MS, 'ms. Proceeding without session.');
        forceStopLoading();
      }
    }, AUTH_TIMEOUT_MS);

    // CRITICAL FIX: Secondary safety net - absolute maximum of 5s
    const safetyTimeout = setTimeout(() => {
      forceStopLoading();
    }, 5000);

    // Set up the auth state change listener inside try/catch
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('🔐 [AUTH] Auth state changed:', event, newSession?.user?.email);

        // CRITICAL FIX: If signOut is in progress, only confirm SIGNED_OUT
        if (isSigningOutRef.current) {
          if (event === 'SIGNED_OUT') {
            console.log('🔐 [AUTH] Confirmed SIGNED_OUT during signOut flow');
            if (isMounted) {
              setSession(null);
              setUser(null);
              loadingResolvedRef.current = true;
              setLoading(false);
            }
          } else {
            console.log('🔐 [AUTH] Ignoring', event, 'during signOut flow');
          }
          return;
        }

        if (isMounted) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          loadingResolvedRef.current = true;
          setLoading(false);

          // If a real user signs in, exit demo mode
          if (newSession?.user) {
            setIsDemoMode(false);
          }
        }

        if (event === 'PASSWORD_RECOVERY') {
          console.log('🔑 [AUTH] PASSWORD_RECOVERY event detected');
          if (isMounted) setIsPasswordRecovery(true);
        }

        if (event === 'USER_UPDATED' && isPasswordRecovery) {
          console.log('✅ [AUTH] User updated after password recovery');
          if (isMounted) setIsPasswordRecovery(false);
        }

        if (event === 'SIGNED_IN' && newSession?.user) {
          console.log('🔐 [AUTH] User signed in, ensuring subscription record...');
          // Don't await this - it's not critical for auth flow
          ensureSubscriptionRecord(newSession.user.id).catch(() => {});
        }
      });

      subscription = sub;
    } catch (err) {
      console.error('❌ [AUTH] Failed to set up onAuthStateChange listener:', err);
      // If listener setup fails, force stop loading
      forceStopLoading();
    }

    // Then get the current session - wrapped in robust error handling
    const initializeAuth = async () => {
      try {
        console.log('🔵 [AUTH] Initializing auth, getting session...');
        
        // CRITICAL FIX: Race the getSession call against a timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), AUTH_TIMEOUT_MS - 500);
        });
        
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (!result) {
          console.warn('⚠️ [AUTH] getSession timed out, proceeding without session');
          if (isMounted) {
            loadingResolvedRef.current = true;
            setLoading(false);
          }
          return;
        }

        const { data: { session: currentSession }, error } = result;

        if (error) {
          console.error('❌ [AUTH] Error getting session:', error);
        }

        if (isMounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          loadingResolvedRef.current = true;
          setLoading(false);
          console.log('🟢 [AUTH] Auth initialized. User:', currentSession?.user?.email ?? 'none');
        }

        if (currentSession?.user) {
          // Don't await - not critical for auth flow
          ensureSubscriptionRecord(currentSession.user.id).catch(() => {});
        }
      } catch (err) {
        console.error('❌ [AUTH] Exception during auth initialization:', err);
        if (isMounted) {
          loadingResolvedRef.current = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      clearTimeout(primaryTimeout);
      clearTimeout(safetyTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: { message: 'Supabase not configured' } as AuthError };
    }
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: { message: 'Supabase not configured' } as AuthError };
    }
    try {
      console.log('🔵 [AUTH] Signing in with email:', email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('🔴 [AUTH] Sign in error:', error);
      } else {
        console.log('✅ [AUTH] Sign in successful');
      }
      return { error };
    } catch (err) {
      console.error('❌ [AUTH] Sign in exception:', err);
      return { error: { message: err instanceof Error ? err.message : 'Sign in failed' } as AuthError };
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('🔴 [AUTH] signOut called, isDemoMode:', isDemoMode);
    
    if (isDemoMode) {
      setIsDemoMode(false);
      setUser(null);
      setSession(null);
      return;
    }
    
    // CRITICAL FIX: Set signing out flag BEFORE clearing state
    isSigningOutRef.current = true;
    
    // Clear local state immediately
    setIsPasswordRecovery(false);
    setUser(null);
    setSession(null);
    
    if (!isSupabaseConfigured()) {
      isSigningOutRef.current = false;
      return;
    }
    
    try {
      await supabase.auth.signOut();
      console.log('✅ [AUTH] Supabase signOut successful');
    } catch (err) {
      console.error('❌ [AUTH] Supabase signOut error (state already cleared):', err);
    } finally {
      // Reset the flag after a short delay to allow the SIGNED_OUT event to be processed
      setTimeout(() => {
        isSigningOutRef.current = false;
      }, 500);
    }
  }, [isDemoMode]);

  const enterDemoMode = useCallback(() => {
    console.log('🎭 [AUTH] Entering demo mode');
    setIsDemoMode(true);
    setUser(DEMO_USER);
    setSession(null);
    setLoading(false);
    loadingResolvedRef.current = true;
  }, []);

  const exitDemoMode = useCallback(() => {
    console.log('🎭 [AUTH] Exiting demo mode');
    setIsDemoMode(false);
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isPasswordRecovery,
        isDemoMode,
        signUp,
        signIn,
        signOut,
        enterDemoMode,
        exitDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}