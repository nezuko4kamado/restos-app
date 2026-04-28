import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Globe, Bell, MessageSquare, Palette, Save, Trash2, AlertTriangle } from 'lucide-react';
import { getSettings, saveSettings } from '@/lib/storage';
import type { Settings } from '@/types';
import { useLanguage, type Language } from '@/lib/i18n';
import { getDefaultTemplates } from '@/lib/messageTemplates';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsSectionProps {
  settings: Settings;
  onSettingsUpdate?: (settings: Settings) => void;
}

/**
 * Apply visual settings (theme, font size, layout mode) to the DOM.
 * This is the single source of truth for DOM-level appearance changes.
 */
function applySettingsToDOM(settings: Settings) {
  const root = document.documentElement;

  // ✅ Theme: toggle Tailwind "dark" class
  if (settings.theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // ✅ Font Size: swap font-small / font-medium / font-large classes
  root.classList.remove('font-small', 'font-medium', 'font-large');
  const fontSize = settings.fontSize || 'medium';
  root.classList.add(`font-${fontSize}`);

  // ✅ Layout Mode: swap layout-compact / layout-expanded classes
  root.classList.remove('layout-compact', 'layout-expanded');
  const layoutMode = settings.layoutMode || 'expanded';
  root.classList.add(`layout-${layoutMode}`);
}

export function SettingsSection({ settings, onSettingsUpdate }: SettingsSectionProps) {
  const { t, language: currentLanguage, setLanguage: setI18nLanguage } = useLanguage();
  const { user } = useAuth();
  
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmWord, setDeleteConfirmWord] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ✅ Apply settings to DOM on mount and whenever settings prop changes
  useEffect(() => {
    setLocalSettings(settings);
    applySettingsToDOM(settings);
  }, [settings]);

  // ✅ Sync localSettings.language with the actual i18n language
  // This fixes the bug where the language selector shows "Italiano" even when
  // the app is in French (because settings from storage had language="it" as default,
  // but the i18n context was changed to "fr" from the login page).
  useEffect(() => {
    if (currentLanguage && localSettings.language !== currentLanguage) {
      setLocalSettings(prev => ({ ...prev, language: currentLanguage }));
    }
  }, [currentLanguage]);

  const handleCountryChange = async (country: string) => {
    const updatedSettings = { ...localSettings, country };
    setLocalSettings(updatedSettings);
    
    try {
      await saveSettings(updatedSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(updatedSettings);
      }
      
      const currencyMap: Record<string, string> = {
        'IT': 'EUR', 'ES': 'EUR', 'FR': 'EUR', 'DE': 'EUR',
        'GB': 'GBP', 'US': 'USD', 'LT': 'EUR'
      };
      const currency = currencyMap[country] || 'EUR';
      
      toast.success(t('settingsSection.countryUpdated'), {
        description: t('settingsSection.currencyAndLanguage', { 
          currency, 
          language: currentLanguage.toUpperCase() 
        }),
      });
    } catch (error) {
      console.error('Error saving country:', error);
      toast.error(t('settingsSection.errorSavingCountry'));
    }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    // ✅ Auto-update message templates to match the new language
    const newDefaultTemplates = getDefaultTemplates(newLanguage);
    const oldDefaultTemplates = getDefaultTemplates(localSettings.language || 'it');
    
    // Check if user has customized templates (compare with old language defaults)
    // Use trimmed comparison to avoid whitespace mismatches from DB storage
    const currentWhatsapp = (localSettings.messageTemplates?.whatsapp || '').trim();
    const currentEmail = (localSettings.messageTemplates?.email || '').trim();
    
    // Also check against ALL language defaults - if the template matches any language's default,
    // it should be considered "not customized" and should be updated
    const allLanguages = ['it', 'en', 'es', 'fr', 'de', 'lt'];
    const isWhatsappAnyDefault = !currentWhatsapp || allLanguages.some(lang => {
      const defaults = getDefaultTemplates(lang);
      return currentWhatsapp === defaults.whatsapp.trim();
    });
    const isEmailAnyDefault = !currentEmail || allLanguages.some(lang => {
      const defaults = getDefaultTemplates(lang);
      return currentEmail === defaults.email.trim();
    });
    
    const updatedTemplates = {
      whatsapp: isWhatsappAnyDefault ? newDefaultTemplates.whatsapp : currentWhatsapp,
      email: isEmailAnyDefault ? newDefaultTemplates.email : currentEmail,
    };

    const updatedSettings = { ...localSettings, language: newLanguage, messageTemplates: updatedTemplates };
    setLocalSettings(updatedSettings);

    // ✅ FIX: Update i18n context IMMEDIATELY (before async save) so UI re-renders right away
    setI18nLanguage(newLanguage as Language);
    
    try {
      // Save to storage
      await saveSettings(updatedSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(updatedSettings);
      }
      
      const languageLabels: Record<string, string> = {
        'it': t('settingsSection.italian'),
        'en': t('settingsSection.english'),
        'es': t('settingsSection.spanish'),
        'fr': t('settingsSection.french'),
        'de': t('settingsSection.german'),
        'lt': t('settingsSection.lithuanian')
      };
      
      toast.success(t('settingsSection.languageUpdated'), {
        description: t('settingsSection.languageChangedTo', { language: languageLabels[newLanguage] || newLanguage }),
      });
    } catch (error) {
      console.error('Error saving language:', error);
      toast.error(t('settingsSection.errorSavingLanguage'));
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    const updatedSettings = { ...localSettings, defaultCurrency: currency };
    setLocalSettings(updatedSettings);
    
    try {
      await saveSettings(updatedSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(updatedSettings);
      }
      
      toast.success(t('settingsSection.currencyUpdated'), {
        description: t('settingsSection.currencyChangedTo', { currency }),
      });
    } catch (error) {
      console.error('Error saving currency:', error);
      toast.error(t('settingsSection.errorSavingCurrency'));
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    const updatedSettings = { ...localSettings, theme };
    setLocalSettings(updatedSettings);
    
    // ✅ Apply theme to DOM immediately
    applySettingsToDOM(updatedSettings);
    
    try {
      await saveSettings(updatedSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(updatedSettings);
      }
      
      const themeLabels = {
        'light': t('settingsSection.light'),
        'dark': t('settingsSection.dark')
      };
      
      toast.success(t('settingsSection.themeUpdated'), {
        description: t('settingsSection.themeChangedTo', { theme: themeLabels[theme] }),
      });
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error(t('settingsSection.errorSavingTheme'));
    }
  };

  const handleFontSizeChange = async (fontSize: 'small' | 'medium' | 'large') => {
    const updatedSettings = { ...localSettings, fontSize };
    setLocalSettings(updatedSettings);
    
    // ✅ Apply font size to DOM immediately
    applySettingsToDOM(updatedSettings);
    
    try {
      await saveSettings(updatedSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(updatedSettings);
      }
      
      const fontSizeLabels = {
        'small': t('settingsSection.small'),
        'medium': t('settingsSection.medium'),
        'large': t('settingsSection.large')
      };
      
      toast.success(t('settingsSection.fontSizeUpdated'), {
        description: t('settingsSection.fontSizeChangedTo', { size: fontSizeLabels[fontSize] }),
      });
    } catch (error) {
      console.error('Error saving font size:', error);
      toast.error(t('settingsSection.errorSavingFontSize'));
    }
  };

  const handleLayoutModeChange = async (layoutMode: 'compact' | 'expanded') => {
    const updatedSettings = { ...localSettings, layoutMode };
    setLocalSettings(updatedSettings);
    
    // ✅ Apply layout mode to DOM immediately
    applySettingsToDOM(updatedSettings);
    
    try {
      await saveSettings(updatedSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(updatedSettings);
      }
      
      const layoutModeLabels = {
        'compact': t('settingsSection.compact'),
        'expanded': t('settingsSection.expanded')
      };
      
      toast.success(t('settingsSection.layoutUpdated'), {
        description: t('settingsSection.layoutChangedTo', { mode: layoutModeLabels[layoutMode] }),
      });
    } catch (error) {
      console.error('Error saving layout mode:', error);
      toast.error(t('settingsSection.errorSavingLayout'));
    }
  };

  const handleMessageTemplatesChange = (field: 'whatsapp' | 'email', value: string) => {
    const updatedTemplates = {
      ...localSettings.messageTemplates,
      [field]: value
    };
    setLocalSettings({
      ...localSettings,
      messageTemplates: updatedTemplates
    });
  };

  const handleResetTemplates = async () => {
    // Get default templates based on current language
    const defaultTemplates = getDefaultTemplates(currentLanguage);
    
    const updatedSettings = {
      ...localSettings,
      messageTemplates: defaultTemplates
    };
    
    setLocalSettings(updatedSettings);
    
    try {
      await saveSettings(updatedSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(updatedSettings);
      }
      
      toast.success(t('settingsSection.templatesReset'), {
        description: t('settingsSection.templatesResetDesc'),
      });
    } catch (error) {
      console.error('Error resetting templates:', error);
      toast.error(t('settingsSection.errorSavingSettings'));
    }
  };

  const handleNotificationChange = (field: string, value: number | boolean) => {
    const updatedNotifications = {
      ...localSettings.notifications,
      [field]: value
    };
    setLocalSettings({
      ...localSettings,
      notifications: updatedNotifications
    });
  };

  const handleSaveAllSettings = async () => {
    setIsSaving(true);
    try {
      await saveSettings(localSettings);
      
      // ✅ Apply all settings to DOM when saving
      applySettingsToDOM(localSettings);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(localSettings);
      }
      
      toast.success(t('settingsSection.settingsSavedSuccess'));
    } catch (error) {
      console.error('Error saving all settings:', error);
      toast.error(t('settingsSection.errorSavingSettings'));
    } finally {
      setIsSaving(false);
    }
  };

  const expectedConfirmWord = t('settingsSection.deleteAccountConfirmWord');

  const handleDeleteAccount = async () => {
    if (deleteConfirmWord !== expectedConfirmWord) return;

    setIsDeleting(true);
    try {
      if (isSupabaseConfigured() && user) {
        const { data, error: fnError } = await supabase.functions.invoke('delete_user', {
          method: 'POST',
        });

        if (fnError) {
          console.error('Error calling delete_user function:', fnError);
          toast.error(t('settingsSection.deleteAccountError'));
          setIsDeleting(false);
          return;
        }

        if (data && !data.success) {
          console.error('delete_user function returned error:', data.error);
          toast.error(t('settingsSection.deleteAccountError'));
          setIsDeleting(false);
          return;
        }

        try {
          await supabase.auth.signOut();
        } catch {
          console.log('SignOut after deletion (expected to potentially fail)');
        }
      }

      localStorage.clear();

      toast.success(t('settingsSection.deleteAccountSuccess'));

      setDeleteDialogOpen(false);
      setDeleteConfirmWord('');

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(t('settingsSection.deleteAccountError'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-4xl mx-auto px-2 sm:px-4">
      {/* General Settings Card */}
      <Card className="shadow-lg border-2 border-purple-100 dark:border-purple-900 hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-b border-purple-100 dark:border-purple-900 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t('settingsSection.generalSettings')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {/* Language */}
          <div className="space-y-2">
            <Label htmlFor="language" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.language')}
            </Label>
            {/* ✅ FIX: use currentLanguage from i18n context as the controlled value */}
            <Select value={currentLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="w-full border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">{t('settingsSection.italian')}</SelectItem>
                <SelectItem value="en">{t('settingsSection.english')}</SelectItem>
                <SelectItem value="es">{t('settingsSection.spanish')}</SelectItem>
                <SelectItem value="fr">{t('settingsSection.french')}</SelectItem>
                <SelectItem value="de">{t('settingsSection.german')}</SelectItem>
                <SelectItem value="lt">{t('settingsSection.lithuanian')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label htmlFor="currency" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.currency')}
            </Label>
            <Select value={localSettings.defaultCurrency} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="currency" className="w-full border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">{t('settingsSection.euro')}</SelectItem>
                <SelectItem value="USD">{t('settingsSection.usDollar')}</SelectItem>
                <SelectItem value="GBP">{t('settingsSection.britishPound')}</SelectItem>
                <SelectItem value="CHF">{t('settingsSection.swissFranc')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings Card */}
      <Card className="shadow-lg border-2 border-purple-100 dark:border-purple-900 hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-b border-purple-100 dark:border-purple-900 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t('settingsSection.theme')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {/* Theme */}
          <div className="space-y-2">
            <Label htmlFor="theme" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.theme')}
            </Label>
            <Select value={localSettings.theme || 'light'} onValueChange={(value) => handleThemeChange(value as 'light' | 'dark')}>
              <SelectTrigger id="theme" className="w-full border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('settingsSection.lightTheme')}</SelectItem>
                <SelectItem value="dark">{t('settingsSection.darkTheme')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <Label htmlFor="fontSize" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.fontSize')}
            </Label>
            <Select value={localSettings.fontSize || 'medium'} onValueChange={(value) => handleFontSizeChange(value as 'small' | 'medium' | 'large')}>
              <SelectTrigger id="fontSize" className="w-full border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{t('settingsSection.smallFont')}</SelectItem>
                <SelectItem value="medium">{t('settingsSection.mediumFont')}</SelectItem>
                <SelectItem value="large">{t('settingsSection.largeFont')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Layout Mode */}
          <div className="space-y-2">
            <Label htmlFor="layoutMode" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.layoutMode')}
            </Label>
            <Select value={localSettings.layoutMode || 'expanded'} onValueChange={(value) => handleLayoutModeChange(value as 'compact' | 'expanded')}>
              <SelectTrigger id="layoutMode" className="w-full border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t('settingsSection.compactLayout')}</SelectItem>
                <SelectItem value="expanded">{t('settingsSection.expandedLayout')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Message Templates Card */}
      <Card className="shadow-lg border-2 border-purple-100 dark:border-purple-900 hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-b border-purple-100 dark:border-purple-900 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {t('settingsSection.messageTemplates')}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  {t('settingsSection.customizeMessages')}
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResetTemplates}
              className="border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950 hover:border-purple-300 transition-colors w-full sm:w-auto"
            >
              {t('settingsSection.resetTemplates')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 font-medium mb-2">
              {t('settingsSection.availablePlaceholders')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-blue-700 dark:text-blue-400">
              <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{'}storeName{'}'}</code> - {t('settingsSection.storeNamePlaceholder')}</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{'}supplierName{'}'}</code> - {t('settingsSection.supplierNamePlaceholder')}</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{'}orderDate{'}'}</code> - {t('settingsSection.orderDatePlaceholder')}</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{'}products{'}'}</code> - {t('settingsSection.productsPlaceholder')}</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{'{'}total{'}'}</code> - {t('settingsSection.totalPlaceholder')}</div>
            </div>
          </div>

          {/* WhatsApp Template */}
          <div className="space-y-2">
            <Label htmlFor="whatsappTemplate" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.whatsappTemplate')}
            </Label>
            <Textarea
              id="whatsappTemplate"
              value={localSettings.messageTemplates?.whatsapp || ''}
              onChange={(e) => handleMessageTemplatesChange('whatsapp', e.target.value)}
              placeholder={t('settingsSection.whatsappTemplatePlaceholder')}
              className="min-h-[120px] sm:min-h-[150px] border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors font-mono text-xs sm:text-sm"
            />
          </div>

          {/* Email Template */}
          <div className="space-y-2">
            <Label htmlFor="emailTemplate" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.emailTemplate')}
            </Label>
            <Textarea
              id="emailTemplate"
              value={localSettings.messageTemplates?.email || ''}
              onChange={(e) => handleMessageTemplatesChange('email', e.target.value)}
              placeholder={t('settingsSection.emailTemplatePlaceholder')}
              className="min-h-[120px] sm:min-h-[150px] border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors font-mono text-xs sm:text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card className="shadow-lg border-2 border-purple-100 dark:border-purple-900 hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-b border-purple-100 dark:border-purple-900 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {t('settingsSection.notificationsTitle')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {t('settingsSection.configureNotifications')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {/* Price Change Threshold */}
          <div className="space-y-2">
            <Label htmlFor="priceThreshold" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.priceChangeThreshold')}
            </Label>
            <Input
              id="priceThreshold"
              type="number"
              min="1"
              max="100"
              value={localSettings.notifications?.price_change_threshold || 10}
              onChange={(e) => handleNotificationChange('price_change_threshold', parseInt(e.target.value))}
              className="border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors"
            />
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {t('settingsSection.priceChangeThresholdDesc')}
            </p>
          </div>

          {/* Recurring Order Reminders */}
          <div className="flex items-center justify-between p-3 sm:p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-100 dark:border-purple-800">
            <div className="space-y-1 flex-1">
              <Label htmlFor="recurringReminders" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                {t('settingsSection.recurringOrderReminders')}
              </Label>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {t('settingsSection.recurringOrderRemindersDesc')}
              </p>
            </div>
            <Switch
              id="recurringReminders"
              checked={localSettings.notifications?.enable_recurring_reminders ?? true}
              onCheckedChange={(checked) => handleNotificationChange('enable_recurring_reminders', checked)}
              className="ml-2 sm:ml-4"
            />
          </div>

          {/* Reminder Days Advance */}
          <div className="space-y-2">
            <Label htmlFor="reminderDays" className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('settingsSection.reminderDaysAdvance')}
            </Label>
            <Input
              id="reminderDays"
              type="number"
              min="1"
              max="30"
              value={localSettings.notifications?.recurring_order_reminder_days || 3}
              onChange={(e) => handleNotificationChange('recurring_order_reminder_days', parseInt(e.target.value))}
              className="border-2 border-purple-100 dark:border-purple-800 focus:border-purple-300 transition-colors"
            />
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {t('settingsSection.reminderDaysAdvanceDesc')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="shadow-lg border-2 border-red-200 dark:border-red-900 hover:border-red-300 dark:hover:border-red-800 transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-b border-red-200 dark:border-red-900 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">
                {t('settingsSection.dangerZone')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1 text-red-500">
                {t('settingsSection.dangerZoneDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <div className="space-y-1 flex-1">
              <p className="text-sm sm:text-base font-semibold text-red-700 dark:text-red-400">
                {t('settingsSection.deleteAccount')}
              </p>
              <p className="text-xs sm:text-sm text-red-600 dark:text-red-500">
                {t('settingsSection.deleteAccountWarning')}
              </p>
            </div>
            <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setDeleteConfirmWord('');
              }
            }}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('settingsSection.deleteAccount')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    {t('settingsSection.deleteAccount')}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-left space-y-3">
                    <p>{t('settingsSection.deleteAccountWarning')}</p>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="confirmWord" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('settingsSection.deleteAccountConfirmLabel', { word: expectedConfirmWord })}
                      </Label>
                      <Input
                        id="confirmWord"
                        value={deleteConfirmWord}
                        onChange={(e) => setDeleteConfirmWord(e.target.value)}
                        placeholder={expectedConfirmWord}
                        className="border-2 border-red-200 focus:border-red-400 transition-colors"
                        autoComplete="off"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmWord('')}>
                    {t('cancel')}
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmWord !== expectedConfirmWord || isDeleting}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        {t('settingsSection.deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('settingsSection.deleteAccount')}
                      </>
                    )}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-2 sm:pt-4">
        <Button
          onClick={handleSaveAllSettings}
          disabled={isSaving}
          size="lg"
          className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 px-6 sm:px-8"
        >
          <Save className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          {isSaving ? t('settingsSection.savingSettings') : t('settingsSection.saveSettings')}
        </Button>
      </div>
    </div>
  );
}