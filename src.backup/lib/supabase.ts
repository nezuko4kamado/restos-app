import { createClient } from '@supabase/supabase-js';
import type { User, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Only create Supabase client if credentials are provided
export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as unknown as SupabaseClient; // Fallback to null if not configured

// Show warning only once
if (!isSupabaseConfigured()) {
  console.warn('⚠️ Supabase credentials not configured. Using localStorage fallback.');
  console.warn('To enable cloud sync, create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Auth helpers with null checks
export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const signUp = async (email: string, password: string, metadata?: { full_name?: string }) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  
  console.log('🔵 [SIGNUP] Starting registration for:', email);
  console.log('🔵 [SIGNUP] Metadata:', metadata);
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });
    
    console.log('🔵 [SIGNUP] Supabase response:', {
      user: data?.user?.id,
      session: !!data?.session,
      error: error ? {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error
      } : null
    });
    
    if (error) {
      console.error('🔴 [SIGNUP ERROR] Full error object:', JSON.stringify(error, null, 2));
      console.error('🔴 [SIGNUP ERROR] Error message:', error.message);
      console.error('🔴 [SIGNUP ERROR] Error code:', error.code);
      console.error('🔴 [SIGNUP ERROR] Error status:', error.status);
    }
    
    return { data, error };
  } catch (err) {
    console.error('🔴 [SIGNUP EXCEPTION] Caught exception:', err);
    console.error('🔴 [SIGNUP EXCEPTION] Exception type:', err instanceof Error ? err.constructor.name : typeof err);
    console.error('🔴 [SIGNUP EXCEPTION] Exception message:', err instanceof Error ? err.message : String(err));
    throw err;
  }
};

export const signIn = async (email: string, password: string) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!isSupabaseConfigured()) {
    callback(null);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
};