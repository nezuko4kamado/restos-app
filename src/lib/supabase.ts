import { createClient } from '@supabase/supabase-js'
import type { User, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tmxmkvinsvuzbzrjrucw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteG1rdmluc3Z1emJ6cmpydWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mzc4ODIsImV4cCI6MjA3ODUxMzg4Mn0.bz5siYBfM4UVV6cerbHPzmII7DnDLP3ynH2OV2Ts3So'

console.log('🔧 Supabase Config:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey.length,
  hasKey: !!supabaseAnonKey
})

export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl !== 'your-supabase-url' && 
    supabaseUrl !== 'your_supabase_url' &&
    supabaseAnonKey !== 'your-supabase-anon-key' &&
    supabaseAnonKey !== 'your_supabase_anon_key' &&
    supabaseUrl.startsWith('http')
  )
}

// Create a mock client for when Supabase is not configured
const createMockClient = (): SupabaseClient => {
  const mockClient = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signUp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      signOut: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        callback('SIGNED_OUT', null)
        return { data: { subscription: { unsubscribe: () => {} } } }
      }
    },
    functions: {
      invoke: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
    }
  } as unknown as SupabaseClient
  
  return mockClient
}

// Custom storage adapter that handles iframe restrictions gracefully
const createSafeStorage = () => {
  // Test if localStorage is accessible
  let localStorageAvailable = false;
  try {
    const testKey = '__supabase_storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    localStorageAvailable = true;
  } catch {
    console.warn('⚠️ localStorage not available (likely iframe restriction), using in-memory storage');
  }

  if (localStorageAvailable) {
    // CRITICAL FIX: Even when localStorage is available, wrap it in try/catch
    // because iframe contexts can revoke access at any time
    return {
      getItem: (key: string): string | null => {
        try {
          return localStorage.getItem(key);
        } catch {
          console.warn('⚠️ localStorage.getItem failed for key:', key);
          return null;
        }
      },
      setItem: (key: string, value: string): void => {
        try {
          localStorage.setItem(key, value);
        } catch {
          console.warn('⚠️ localStorage.setItem failed for key:', key);
        }
      },
      removeItem: (key: string): void => {
        try {
          localStorage.removeItem(key);
        } catch {
          console.warn('⚠️ localStorage.removeItem failed for key:', key);
        }
      },
    };
  }

  // Fallback: in-memory storage for iframe contexts
  const memoryStore = new Map<string, string>();
  return {
    getItem: (key: string): string | null => {
      return memoryStore.get(key) ?? null;
    },
    setItem: (key: string, value: string): void => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string): void => {
      memoryStore.delete(key);
    },
  };
};

const safeStorage = createSafeStorage();

// Create Supabase client - ALWAYS use safeStorage wrapper for resilience
export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: safeStorage,
      }
    })
  : createMockClient()

// Show warning only once
if (!isSupabaseConfigured()) {
  console.warn('⚠️ Supabase credentials not configured. Using localStorage fallback.')
  console.warn('To enable cloud sync, create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

// Auth helpers with null checks
export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('❌ Error getting current user:', error)
      return null
    }
    return user
  } catch (err) {
    console.error('❌ Exception getting current user:', err)
    return null
  }
}

export const signUp = async (email: string, password: string, metadata?: { full_name?: string }) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  console.log('🔵 [SIGNUP] Starting registration for:', email)
  console.log('🔵 [SIGNUP] Metadata:', metadata)
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    })
    
    console.log('🔵 [SIGNUP] Supabase response:', {
      user: data?.user?.id,
      session: !!data?.session,
      error: error ? {
        message: error.message,
        status: error.status,
        code: error.code,
      } : null
    })
    
    if (error) {
      console.error('🔴 [SIGNUP ERROR]:', error)
    }
    
    return { data, error }
  } catch (err) {
    console.error('🔴 [SIGNUP EXCEPTION]:', err)
    throw err
  }
}

export const signIn = async (email: string, password: string) => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  } catch (err) {
    console.error('❌ SignIn exception:', err)
    throw err
  }
}

export const signOut = async () => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') }
  }
  
  try {
    const { error } = await supabase.auth.signOut()
    return { error }
  } catch (err) {
    console.error('❌ SignOut exception:', err)
    throw err
  }
}

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!isSupabaseConfigured()) {
    callback(null)
    return { data: { subscription: { unsubscribe: () => {} } } }
  }
  
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}

export default supabase