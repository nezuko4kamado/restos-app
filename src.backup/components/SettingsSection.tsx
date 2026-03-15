import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { saveSettings } from '@/lib/storage';
import { toast } from 'sonner';
import { Globe, MapPin, Sparkles, Palette, Sun, Moon } from 'lucide-react';
import type { Settings } from '@/types';
import type { Language } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCountryCurrency } from '@/lib/currency';

const countries = [
  { code: 'IT', name: { it: 'Italia', en: 'Italy', es: 'Italia', fr: 'Italie', de: 'Italien', lt: 'Italija' } },
  { code: 'US', name: { it: 'Stati Uniti', en: 'United States', es: 'Estados Unidos', fr: 'États-Unis', de: 'Vereinigte Staaten', lt: 'Jungtinės Valstijos' } },
  { code: 'GB', name: { it: 'Regno Unito', en: 'United Kingdom', es: 'Reino Unido', fr: 'Royaume-Uni', de: 'Vereinigtes Königreich', lt: 'Jungtinė Karalystė' } },
  { code: 'ES', name: { it: 'Spagna', en: 'Spain', es: 'España', fr: 'Espagne', de: 'Spanien', lt: 'Ispanija' } },
  { code: 'FR', name: { it: 'Francia', en: 'France', es: 'Francia', fr: 'France', de: 'Frankreich', lt: 'Prancūzija' } },
  { code: 'DE', name: { it: 'Germania', en: 'Germany', es: 'Alemania', fr: 'Allemagne', de: 'Deutschland', lt: 'Vokietija' } },
  { code: 'LT', name: { it: 'Lituania', en: 'Lithuania', es: 'Lituania', fr: 'Lituanie', de: 'Litauen', lt: 'Lietuva' } },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: { it: 'Piccolo (14px)', en: 'Small (14px)', es: 'Pequeño (14px)', fr: 'Petit (14px)', de: 'Klein (14px)', lt: 'Mažas (14px)' } },
  { value: 'medium', label: { it: 'Medio (16px)', en: 'Medium (16px)', es: 'Medio (16px)', fr: 'Moyen (16px)', de: 'Mittel (16px)', lt: 'Vidutinis (16px)' } },
  { value: 'large', label: { it: 'Grande (18px)', en: 'Large (18px)', es: 'Grande (18px)', fr: 'Grand (18px)', de: 'Groß (18px)', lt: 'Didelis (18px)' } },
];

interface SettingsSectionProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onClearData?: () => void;
}

export default function SettingsSection({ settings, setSettings }: SettingsSectionProps) {
  const { language, setLanguage } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Log settings on every render to track changes
  useEffect(() => {
    console.log('⚙️ SettingsSection render - Current settings:', settings);
    console.log('🌍 Current country:', settings.country);
    console.log('💱 Current currency:', settings.defaultCurrency);
  });

  // FIXED: Only apply settings on mount, don't reload from Supabase
  // Parent component (Index.tsx) already handles loading settings
  useEffect(() => {
    console.log('⚙️ SettingsSection mounted with settings:', settings);
    console.log('🌍 Country on mount:', settings.country);
    console.log('💱 Currency on mount:', settings.defaultCurrency);
    
    // Apply font size
    if (settings.fontSize) {
      applyFontSize(settings.fontSize);
    }

    // Apply theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setIsDarkMode(savedTheme === 'dark');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []); // Only run once on mount

  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    const root = document.documentElement;
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.fontSize = fontSizes[size];
  };

  const handleSaveSettings = async (updatedSettings: Partial<Settings>) => {
    setIsSaving(true);
    try {
      const newSettings = { ...settings, ...updatedSettings };
      console.log('💾 Saving settings:', newSettings);
      console.log('🌍 New country:', newSettings.country);
      console.log('💱 New currency:', newSettings.defaultCurrency);
      
      await saveSettings(newSettings);
      setSettings(newSettings);
      
      // Apply changes immediately
      if (updatedSettings.fontSize) {
        applyFontSize(updatedSettings.fontSize);
      }
      
      toast.success(
        language === 'it' ? 'Impostazioni salvate con successo' :
        language === 'en' ? 'Settings saved successfully' :
        language === 'es' ? 'Configuración guardada correctamente' :
        language === 'fr' ? 'Paramètres enregistrés avec succès' :
        language === 'lt' ? 'Nustatymai sėkmingai išsaugoti' :
        'Einstellungen erfolgreich gespeichert'
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(
        language === 'it' ? 'Errore nel salvataggio delle impostazioni' :
        language === 'en' ? 'Error saving settings' :
        language === 'es' ? 'Error al guardar la configuración' :
        language === 'fr' ? 'Erreur lors de l\'enregistrement des paramètres' :
        language === 'lt' ? 'Klaida išsaugant nustatymus' :
        'Fehler beim Speichern der Einstellungen'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCountryChange = async (value: string) => {
    console.log('🔄 Country selector clicked, changing from:', settings.country, 'to:', value);
    
    // Auto-assign currency based on country
    const newCurrency = getCountryCurrency(value);
    console.log(`🌍 Country changed to ${value}, currency auto-set to ${newCurrency}`);
    
    await handleSaveSettings({ 
      country: value,
      defaultCurrency: newCurrency 
    });
    
    toast.info(
      language === 'it' ? `Paese: ${value}, Valuta: ${newCurrency}` :
      language === 'en' ? `Country: ${value}, Currency: ${newCurrency}` :
      language === 'es' ? `País: ${value}, Moneda: ${newCurrency}` :
      language === 'fr' ? `Pays: ${value}, Devise: ${newCurrency}` :
      language === 'lt' ? `Šalis: ${value}, Valiuta: ${newCurrency}` :
      `Land: ${value}, Währung: ${newCurrency}`
    );
  };

  const handleLanguageChange = async (value: string) => {
    const newLanguage = value as Language;
    setLanguage(newLanguage);
    await handleSaveSettings({ language: value });
  };

  const handleFontSizeChange = async (value: string) => {
    await handleSaveSettings({ fontSize: value as 'small' | 'medium' | 'large' });
  };

  const handleThemeChange = (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light';
    setIsDarkMode(checked);
    
    // Apply immediately
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save to localStorage
    localStorage.setItem('theme', newTheme);
    
    toast.success(
      language === 'it' ? 'Tema aggiornato' :
      language === 'en' ? 'Theme updated' :
      language === 'es' ? 'Tema actualizado' :
      language === 'fr' ? 'Thème mis à jour' :
      language === 'lt' ? 'Tema atnaujinta' :
      'Design aktualisiert'
    );
  };

  return (
    <div className="space-y-6">
      <Card className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border-2 border-indigo-200 dark:border-indigo-800 shadow-xl hover:shadow-2xl transition-all overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950 rounded-t-xl border-b-2 border-indigo-100 dark:border-indigo-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                {language === 'it' ? 'Preferenze' :
                 language === 'en' ? 'Preferences' :
                 language === 'es' ? 'Preferencias' :
                 language === 'fr' ? 'Préférences' :
                 language === 'lt' ? 'Nuostatos' :
                 'Einstellungen'}
              </CardTitle>
              <CardDescription className="text-sm dark:text-slate-400">
                {language === 'it' ? 'Personalizza la tua esperienza' :
                 language === 'en' ? 'Customize your experience' :
                 language === 'es' ? 'Personaliza tu experiencia' :
                 language === 'fr' ? 'Personnalisez votre expérience' :
                 language === 'lt' ? 'Pritaikykite savo patirtį' :
                 'Passen Sie Ihre Erfahrung an'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Language Selection */}
          <div className="space-y-3 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-2 border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:scale-[1.02] shadow-sm">
            <Label htmlFor="language" className="flex items-center gap-3 text-base font-semibold text-blue-900 dark:text-blue-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <span>
                {language === 'it' ? 'Lingua' :
                 language === 'en' ? 'Language' :
                 language === 'es' ? 'Idioma' :
                 language === 'fr' ? 'Langue' :
                 language === 'lt' ? 'Kalba' :
                 'Sprache'}
              </span>
            </Label>
            <Select 
              value={language} 
              onValueChange={handleLanguageChange}
              disabled={isSaving}
            >
              <SelectTrigger 
                id="language"
                className="h-12 border-2 border-blue-200 dark:border-blue-700 focus:border-blue-400 dark:focus:border-blue-500 rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all text-base font-medium"
              >
                <SelectValue placeholder="Seleziona lingua" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-blue-200 dark:border-blue-700 dark:bg-slate-800">
                <SelectItem value="it" className="text-base py-3">🇮🇹 Italiano</SelectItem>
                <SelectItem value="en" className="text-base py-3">🇬🇧 English</SelectItem>
                <SelectItem value="es" className="text-base py-3">🇪🇸 Español</SelectItem>
                <SelectItem value="fr" className="text-base py-3">🇫🇷 Français</SelectItem>
                <SelectItem value="de" className="text-base py-3">🇩🇪 Deutsch</SelectItem>
                <SelectItem value="lt" className="text-base py-3">🇱🇹 Lietuvių</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Country Selection */}
          <div className="space-y-3 p-5 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-2 border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:scale-[1.02] shadow-sm">
            <Label htmlFor="country" className="flex items-center gap-3 text-base font-semibold text-purple-900 dark:text-purple-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <span>
                {language === 'it' ? 'Paese (Valuta Automatica)' :
                 language === 'en' ? 'Country (Auto Currency)' :
                 language === 'es' ? 'País (Moneda Automática)' :
                 language === 'fr' ? 'Pays (Devise Automatique)' :
                 language === 'lt' ? 'Šalis (Automatinė Valiuta)' :
                 'Land (Auto-Währung)'}
              </span>
            </Label>
            <Select 
              value={settings.country} 
              onValueChange={handleCountryChange}
              disabled={isSaving}
            >
              <SelectTrigger 
                id="country"
                className="h-12 border-2 border-purple-200 dark:border-purple-700 focus:border-purple-400 dark:focus:border-purple-500 rounded-xl bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 transition-all text-base font-medium disabled:opacity-60"
                onClick={() => {
                  console.log('🖱️ Country selector button clicked');
                  console.log('🌍 Current country value:', settings.country);
                }}
              >
                <SelectValue placeholder="Seleziona paese" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-purple-200 dark:border-purple-700 dark:bg-slate-800">
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code} className="text-base py-3">
                    {country.name[language as keyof typeof country.name]} ({getCountryCurrency(country.code)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
              {language === 'it' ? `Valuta attuale: ${settings.defaultCurrency || 'EUR'}` :
               language === 'en' ? `Current currency: ${settings.defaultCurrency || 'EUR'}` :
               language === 'es' ? `Moneda actual: ${settings.defaultCurrency || 'EUR'}` :
               language === 'fr' ? `Devise actuelle: ${settings.defaultCurrency || 'EUR'}` :
               language === 'lt' ? `Dabartinė valiuta: ${settings.defaultCurrency || 'EUR'}` :
               `Aktuelle Währung: ${settings.defaultCurrency || 'EUR'}`}
            </p>
          </div>

          {/* Font Size Selection */}
          <div className="space-y-3 p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-2 border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 transition-all hover:scale-[1.02] shadow-sm">
            <Label htmlFor="fontSize" className="flex items-center gap-3 text-base font-semibold text-orange-900 dark:text-orange-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <span>
                {language === 'it' ? 'Dimensione Carattere' :
                 language === 'en' ? 'Font Size' :
                 language === 'es' ? 'Tamaño de Fuente' :
                 language === 'fr' ? 'Taille de Police' :
                 language === 'lt' ? 'Šrifto Dydis' :
                 'Schriftgröße'}
              </span>
            </Label>
            <Select 
              value={settings.fontSize || 'medium'} 
              onValueChange={handleFontSizeChange}
              disabled={isSaving}
            >
              <SelectTrigger 
                id="fontSize"
                className="h-12 border-2 border-orange-200 dark:border-orange-700 focus:border-orange-400 dark:focus:border-orange-500 rounded-xl bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 transition-all text-base font-medium"
              >
                <SelectValue placeholder="Seleziona dimensione" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-orange-200 dark:border-orange-700 dark:bg-slate-800">
                {FONT_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size.value} value={size.value} className="text-base py-3">
                    {size.label[language as keyof typeof size.label]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dark/Light Mode Toggle */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:scale-[1.02] shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-500 to-gray-500 flex items-center justify-center shadow-md">
                {isDarkMode ? 
                  <Moon className="h-5 w-5 text-white" /> : 
                  <Sun className="h-5 w-5 text-white" />
                }
              </div>
              <div>
                <Label className="text-base font-semibold text-slate-900 dark:text-slate-100 cursor-pointer">
                  {language === 'it' ? 'Tema' :
                   language === 'en' ? 'Theme' :
                   language === 'es' ? 'Tema' :
                   language === 'fr' ? 'Thème' :
                   language === 'lt' ? 'Tema' :
                   'Design'}
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {language === 'it' ? 'Chiaro / Scuro' :
                   language === 'en' ? 'Light / Dark' :
                   language === 'es' ? 'Claro / Oscuro' :
                   language === 'fr' ? 'Clair / Sombre' :
                   language === 'lt' ? 'Šviesus / Tamsus' :
                   'Hell / Dunkel'}
                </p>
              </div>
            </div>
            <Switch 
              checked={isDarkMode} 
              onCheckedChange={handleThemeChange}
              className="data-[state=checked]:bg-slate-700"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}