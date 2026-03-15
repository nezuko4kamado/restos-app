import React, { useState, useEffect } from 'react';
import { InvoicesSection } from '@/components/InvoicesSection';
import { getSettings } from '@/lib/storage';
import { Settings } from '@/types';

export function InvoicesPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        console.log('🔄 InvoicesPage: Loading settings from Supabase...');
        const loadedSettings = await getSettings();
        console.log('✅ InvoicesPage: Settings loaded:', loadedSettings);
        console.log('🌍 InvoicesPage: Country:', loadedSettings.country);
        console.log('💱 InvoicesPage: Currency:', loadedSettings.defaultCurrency);
        setSettings(loadedSettings);
      } catch (error) {
        console.error('❌ InvoicesPage: Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="text-muted-foreground dark:text-slate-400">Caricamento impostazioni...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-red-500">Errore nel caricamento delle impostazioni</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <InvoicesSection settings={settings} />
    </div>
  );
}