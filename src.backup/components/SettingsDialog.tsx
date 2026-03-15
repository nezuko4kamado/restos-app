import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey, hasCustomApiKey } from '@/lib/config';
import { getSettings, saveSettings } from '@/lib/storage';
import { CheckCircle2, XCircle, Settings as SettingsIcon, ExternalLink, DollarSign, Palette, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Settings } from '@/types';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'CHF', label: 'CHF', symbol: 'CHF' },
  { value: 'PLN', label: 'PLN', symbol: 'zł' },
  { value: 'SEK', label: 'SEK', symbol: 'kr' },
  { value: 'NOK', label: 'NOK', symbol: 'kr' },
  { value: 'DKK', label: 'DKK', symbol: 'kr' },
];

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useLanguage();
  const [apiKey, setApiKeyState] = useState('');
  const [isCustomKey, setIsCustomKey] = useState(false);
  
  // App Settings State
  const [appSettings, setAppSettings] = useState<Settings>({
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
  
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [testingPriceApi, setTestingPriceApi] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [priceApiStatus, setPriceApiStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Font size options with translations
  const getFontSizeOptions = () => [
    { value: 'small', label: `${t.small} (14px)` },
    { value: 'medium', label: `${t.medium} (16px)` },
    { value: 'large', label: `${t.large} (18px)` },
  ];

  // Layout mode options with translations
  const getLayoutModeOptions = () => [
    { value: 'compact', label: t.compact },
    { value: 'expanded', label: t.expanded },
  ];

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    // Load Gemini API Key
    const currentKey = getGeminiApiKey();
    setApiKeyState(currentKey);
    setIsCustomKey(hasCustomApiKey());

    // Load App Settings from Supabase/localStorage
    try {
      const settings = await getSettings();
      setAppSettings(settings);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error(t.errorLoadingSettings || 'Error loading settings');
    }

    // Reset status
    setSupabaseStatus('idle');
    setPriceApiStatus('idle');
  };

  const handleSaveAllSettings = async () => {
    try {
      // Save Gemini API Key
      if (apiKey.trim()) {
        setGeminiApiKey(apiKey.trim());
        setIsCustomKey(true);
      }

      // Save App Settings to Supabase/localStorage
      await saveSettings(appSettings);

      // Apply font size to root
      applyFontSize(appSettings.fontSize || 'medium');
      
      // Apply layout mode
      applyLayoutMode(appSettings.layoutMode || 'expanded');

      toast.success(t.saveAllSettings || 'Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t.errorSavingSettings || 'Error saving settings');
    }
  };

  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    const root = document.documentElement;
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.fontSize = fontSizes[size];
  };

  const applyLayoutMode = (mode: 'compact' | 'expanded') => {
    const root = document.documentElement;
    if (mode === 'compact') {
      root.classList.add('layout-compact');
      root.classList.remove('layout-expanded');
    } else {
      root.classList.add('layout-expanded');
      root.classList.remove('layout-compact');
    }
  };

  const testSupabaseConnection = async () => {
    setTestingSupabase(true);
    setSupabaseStatus('idle');
    
    try {
      // Simple test: try to get settings
      await getSettings();
      setSupabaseStatus('success');
      toast.success(t.connectionSuccessful || 'Connection successful!');
    } catch (error) {
      setSupabaseStatus('error');
      toast.error(t.connectionError || 'Connection error');
      console.error('Supabase test error:', error);
    } finally {
      setTestingSupabase(false);
    }
  };

  const testPriceApiConnection = async () => {
    setTestingPriceApi(true);
    setPriceApiStatus('idle');
    
    try {
      // Test PriceAPI with a simple request
      const testKey = appSettings.priceApiKey || 'default';
      const response = await fetch(`https://api.priceapi.com/v2/jobs`, {
        method: 'GET',
        headers: {
          'X-API-KEY': testKey,
        },
      });
      
      if (response.ok) {
        setPriceApiStatus('success');
        toast.success(t.connectionSuccessful || 'Connection successful!');
      } else {
        setPriceApiStatus('error');
        toast.error(t.invalidApiKey || 'Invalid API key');
      }
    } catch (error) {
      setPriceApiStatus('error');
      toast.error(t.connectionError || 'Connection error');
      console.error('PriceAPI test error:', error);
    } finally {
      setTestingPriceApi(false);
    }
  };

  const handleResetGeminiKey = () => {
    clearGeminiApiKey();
    const defaultKey = getGeminiApiKey();
    setApiKeyState(defaultKey);
    setIsCustomKey(false);
    toast.success(t.apiKeyReset || 'API key reset to default');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            {t.settings}
          </DialogTitle>
          <DialogDescription>
            {t.configureAppPreferences || 'Configure application preferences'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">
              <DollarSign className="h-4 w-4 mr-2" />
              {t.general}
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              {t.appearance}
            </TabsTrigger>
            <TabsTrigger value="api">
              <Key className="h-4 w-4 mr-2" />
              API
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">{t.defaultCurrency}</Label>
                <Select
                  value={appSettings.defaultCurrency || 'EUR'}
                  onValueChange={(value) =>
                    setAppSettings({ ...appSettings, defaultCurrency: value })
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder={t.selectCurrency || 'Select currency'} />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.defaultCurrencyDescription || 'Default currency used for prices and invoices'}
                </p>
              </div>

              <Alert className="border-blue-500 bg-blue-50">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>{t.selectedCurrency || 'Selected currency'}:</strong>{' '}
                  {CURRENCY_OPTIONS.find((c) => c.value === (appSettings.defaultCurrency || 'EUR'))?.label}
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fontSize">{t.fontSize}</Label>
                <Select
                  value={appSettings.fontSize || 'medium'}
                  onValueChange={(value) =>
                    setAppSettings({
                      ...appSettings,
                      fontSize: value as 'small' | 'medium' | 'large',
                    })
                  }
                >
                  <SelectTrigger id="fontSize">
                    <SelectValue placeholder={t.selectSize || 'Select size'} />
                  </SelectTrigger>
                  <SelectContent>
                    {getFontSizeOptions().map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.modifyTextSize}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="layoutMode">{t.layoutMode}</Label>
                <Select
                  value={appSettings.layoutMode || 'expanded'}
                  onValueChange={(value) =>
                    setAppSettings({
                      ...appSettings,
                      layoutMode: value as 'compact' | 'expanded',
                    })
                  }
                >
                  <SelectTrigger id="layoutMode">
                    <SelectValue placeholder={t.selectLayout || 'Select layout'} />
                  </SelectTrigger>
                  <SelectContent>
                    {getLayoutModeOptions().map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.chooseLayoutMode || 'Choose between compact or expanded layout'}
                </p>
              </div>

              <Alert className="border-purple-500 bg-purple-50">
                <Palette className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-800">
                  <strong>{t.preview || 'Preview'}:</strong> {t.changesAppliedAfterSave || 'Changes will be applied after saving'}
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          {/* API Tab */}
          <TabsContent value="api" className="space-y-4 mt-4">
            <div className="space-y-6">
              {/* Supabase Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Supabase (Backend)</Label>
                  {supabaseStatus === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {supabaseStatus === 'error' && (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <Alert className={supabaseStatus === 'success' ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}>
                  <div className="flex items-center gap-2">
                    {supabaseStatus === 'success' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          {t.supabaseActive || 'Supabase connection active and working'}
                        </AlertDescription>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          {t.supabaseConfigured || 'Supabase configured automatically'}
                        </AlertDescription>
                      </>
                    )}
                  </div>
                </Alert>
                <Button
                  onClick={testSupabaseConnection}
                  variant="outline"
                  className="w-full"
                  disabled={testingSupabase}
                >
                  {testingSupabase ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.testing || 'Testing'}...
                    </>
                  ) : (
                    t.testConnection || 'Test Connection'
                  )}
                </Button>
              </div>

              <div className="border-t pt-4" />

              {/* Google AI (Gemini) Section */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Google AI API Key (OCR)</Label>
                <Alert className={isCustomKey ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}>
                  <div className="flex items-center gap-2">
                    {isCustomKey ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          {t.usingCustomKey || 'Using custom key (unlimited account)'}
                        </AlertDescription>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          {t.usingDefaultKey || 'Using default key (limits: 15 requests/minute)'}
                        </AlertDescription>
                      </>
                    )}
                  </div>
                </Alert>
                <div className="space-y-2">
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKeyState(e.target.value)}
                    placeholder="AIzaSy..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.apiKeyStoredLocally || 'API key is stored only in browser and never sent to external servers'}
                  </p>
                </div>
                <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                  <h4 className="font-semibold text-sm">{t.howToGetApiKey || 'How to get your API key'}:</h4>
                  <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>{t.goToGoogleAIStudio || 'Go to Google AI Studio'}</li>
                    <li>{t.loginWithGoogle || 'Login with your Google Cloud account'}</li>
                    <li>{t.clickGetApiKey || 'Click "Get API Key" or "Create API Key"'}</li>
                    <li>{t.copyAndPasteKey || 'Copy the API key and paste it above'}</li>
                  </ol>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t.openGoogleAIStudio || 'Open Google AI Studio'}
                  </Button>
                </div>
                {isCustomKey && (
                  <Button onClick={handleResetGeminiKey} variant="outline" className="w-full">
                    {t.resetToDefault || 'Reset to Default Key'}
                  </Button>
                )}
              </div>

              <div className="border-t pt-4" />

              {/* PriceAPI Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">PriceAPI.com ({t.optional || 'Optional'})</Label>
                  {priceApiStatus === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {priceApiStatus === 'error' && (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    id="priceApiKey"
                    type="password"
                    value={appSettings.priceApiKey || ''}
                    onChange={(e) =>
                      setAppSettings({ ...appSettings, priceApiKey: e.target.value })
                    }
                    placeholder={t.enterPriceApiKey || 'Enter PriceAPI key (optional)'}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.priceApiKeyDescription || 'Use your personal key for more daily requests. If empty, uses default key.'}
                  </p>
                </div>
                <Button
                  onClick={testPriceApiConnection}
                  variant="outline"
                  className="w-full"
                  disabled={testingPriceApi || !appSettings.priceApiKey}
                >
                  {testingPriceApi ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.testing || 'Testing'}...
                    </>
                  ) : (
                    t.testConnection || 'Test Connection'
                  )}
                </Button>
                <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                  <h4 className="font-semibold text-sm">{t.howToGetPriceApiKey || 'How to get PriceAPI key'}:</h4>
                  <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>{t.goToPriceApi || 'Go to priceapi.com'}</li>
                    <li>{t.createFreeAccount || 'Create a free account'}</li>
                    <li>{t.copyYourApiKey || 'Copy your personal API key'}</li>
                    <li>{t.pasteInField || 'Paste it in the field above'}</li>
                  </ol>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => window.open('https://www.priceapi.com/', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t.openPriceApi || 'Open PriceAPI.com'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSaveAllSettings} className="flex-1">
            {t.saveAllSettings}
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}