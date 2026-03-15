import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '@/lib/storage';
import type { Settings } from '@/types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    country: 'IT',
    language: 'it',
    defaultCurrency: 'EUR',
    fontSize: 'medium',
    layoutMode: 'expanded',
    priceApiKey: '',
    notifications: {
      price_change_threshold: 10,
      recurring_order_reminder_days: 3,
      enable_recurring_reminders: true
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      setError(null);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to load settings'));
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      setError(null);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to save settings'));
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings: loadSettings
  };
}