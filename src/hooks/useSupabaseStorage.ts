import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Custom hook for Supabase storage - PURE SUPABASE, NO LOCALSTORAGE
 * This hook provides a React-friendly interface to Supabase storage
 */
export function useSupabaseStorage<T>(
  tableName: string,
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => Promise<void>, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  // Get current user ID
  const getCurrentUserId = async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  // Load data from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const userId = await getCurrentUserId();
        
        if (!userId) {
          console.warn('⚠️ No user logged in, using initial value');
          setStoredValue(initialValue);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', userId)
          .eq('key', key)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No data found, use initial value
            setStoredValue(initialValue);
          } else {
            throw error;
          }
        } else if (data) {
          setStoredValue(data.value as T);
        }
      } catch (error) {
        console.error(`❌ Error loading from Supabase (${tableName}.${key}):`, error);
        setStoredValue(initialValue);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromSupabase();
  }, [tableName, key, initialValue]);

  // Save data to Supabase
  const setValue = async (value: T | ((val: T) => T)) => {
    try {
      const userId = await getCurrentUserId();
      
      if (!userId) {
        console.error('❌ No user logged in, cannot save to Supabase');
        throw new Error('User not authenticated');
      }

      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      const { error } = await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          key: key,
          value: valueToStore,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key'
        });

      if (error) throw error;
      console.log(`✅ Saved to Supabase (${tableName}.${key})`);
    } catch (error) {
      console.error(`❌ Error saving to Supabase (${tableName}.${key}):`, error);
      throw error;
    }
  };

  return [storedValue, setValue, isLoading];
}

interface UserSettings {
  user_id: string;
  country: string;
  language: string;
  default_currency: string;
  font_size: string;
  layout_mode: string;
  store_name: string;
  price_change_threshold: number;
  recurring_order_reminder_days: number;
  enable_recurring_reminders: boolean;
  updated_at?: string;
}

/**
 * Hook for managing user settings in Supabase
 */
export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (!supabase) {
          console.error('❌ Supabase not configured');
          setIsLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.warn('⚠️ No user logged in');
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No settings found, create default
            const defaultSettings: UserSettings = {
              user_id: user.id,
              country: 'IT',
              language: 'it',
              default_currency: 'EUR',
              font_size: 'medium',
              layout_mode: 'expanded',
              store_name: 'Il Mio Ristorante',
              price_change_threshold: 10,
              recurring_order_reminder_days: 3,
              enable_recurring_reminders: true
            };

            const { error: insertError } = await supabase
              .from('user_settings')
              .insert(defaultSettings);

            if (insertError) throw insertError;
            setSettings(defaultSettings);
          } else {
            throw error;
          }
        } else {
          setSettings(data as UserSettings);
        }
      } catch (error) {
        console.error('❌ Error loading user settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings({ ...settings!, ...updates });
      console.log('✅ Settings updated successfully');
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      throw error;
    }
  };

  return { settings, updateSettings, isLoading };
}