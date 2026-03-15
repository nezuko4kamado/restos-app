import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment or use placeholder
const getSupabaseConfig = () => {
  // Check if running in MGX environment with Supabase enabled
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  return { supabaseUrl, supabaseKey };
};

let supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = () => {
  if (supabaseClient) return supabaseClient;
  
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  return supabaseClient;
};

export function useSupabaseStorage<T>(
  key: string,
  initialValue: T,
  tableName: string = 'app_data'
): [T, (value: T | ((val: T) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const client = getSupabaseClient();

  // Fallback to localStorage if Supabase is not configured
  const useLocalStorageFallback = !client;

  // Read from localStorage
  const readLocalStorage = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  // Write to localStorage
  const writeLocalStorage = (value: T) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`Error writing localStorage key "${key}":`, error);
      }
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      if (useLocalStorageFallback) {
        // Use localStorage as fallback
        const localData = readLocalStorage();
        setStoredValue(localData);
        setIsLoading(false);
        return;
      }

      try {
        // Try to load from Supabase
        const { data, error } = await client!
          .from(tableName)
          .select('data')
          .eq('key', key)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No data found, use initial value
            setStoredValue(initialValue);
          } else {
            console.warn(`Error loading from Supabase:`, error);
            // Fallback to localStorage
            const localData = readLocalStorage();
            setStoredValue(localData);
          }
        } else if (data) {
          setStoredValue(data.data as T);
          // Sync to localStorage as backup
          writeLocalStorage(data.data as T);
        }
      } catch (error) {
        console.warn(`Error loading data:`, error);
        // Fallback to localStorage
        const localData = readLocalStorage();
        setStoredValue(localData);
      }

      setIsLoading(false);
    };

    loadData();
  }, [key]);

  // Set value function
  const setValue = async (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Update state immediately
      setStoredValue(valueToStore);

      if (useLocalStorageFallback) {
        // Use localStorage as fallback
        writeLocalStorage(valueToStore);
        return;
      }

      // Save to localStorage as backup
      writeLocalStorage(valueToStore);

      // Save to Supabase
      const { error } = await client!
        .from(tableName)
        .upsert(
          { key, data: valueToStore, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) {
        console.warn(`Error saving to Supabase:`, error);
      }
    } catch (error) {
      console.warn(`Error setting value:`, error);
    }
  };

  return [storedValue, setValue, isLoading];
}