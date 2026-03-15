import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { signIn, signUp, supabase } from '@/lib/supabase';
import { Mail, Lock, UserPlus, LogIn, Languages } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { languageOptions } from '@/lib/i18n';
import { getSettings, saveSettings } from '@/lib/storage';
import type { Language } from '@/lib/i18n';

interface AuthProps {
  onAuthSuccess: () => void;
}

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

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language, setLanguage, t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(t('enterEmailPassword'));
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      toast.error(t('passwordsDontMatch'));
      return;
    }

    if (password.length < 6) {
      toast.error(t('passwordMinLength'));
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error(t('emailOrPasswordIncorrect'));
          } else {
            toast.error(`${t('error')}: ${error.message}`);
          }
        } else {
          try {
            const settings = await getSettings();
            setLanguage(settings.language as Language);
          } catch (err) {
            console.warn('Could not load settings after login:', err);
          }
          
          toast.success(`${t('success')}!`);
          onAuthSuccess();
        }
      } else {
        const { data, error } = await signUp(email, password);

        if (error && error.message.includes('Database error')) {
          console.warn('⚠️ [AUTH] Database error during signup — attempting recovery via sign-in...');

          const { data: recoveryData, error: recoveryError } = await signIn(email, password);

          if (!recoveryError && recoveryData?.user) {
            console.log('🟢 [AUTH] Recovery sign-in succeeded for user:', recoveryData.user.id);
            await ensureSubscriptionRecord(recoveryData.user.id);

            try {
              await saveSettings({
                country: 'IT',
                language: language,
                notifications: {
                  price_change_threshold: 10,
                  recurring_order_reminder_days: 3,
                  enable_price_alerts: true,
                  enable_recurring_reminders: true,
                },
              });
            } catch (settingsErr) {
              console.warn('Could not save initial settings:', settingsErr);
            }

            toast.success(t('registrationComplete'));
            onAuthSuccess();
            return;
          }

          console.error('🔴 [AUTH] Recovery sign-in also failed:', recoveryError);
          toast.error(t('databaseErrorRegistration') || 'Database error during registration. Please try again.');
          return;
        }

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error(t('emailAlreadyRegistered'));
          } else {
            toast.error(`${t('error')}: ${error.message}`);
          }
        } else {
          if (data?.user) {
            await ensureSubscriptionRecord(data.user.id);
          }

          try {
            await saveSettings({
              country: 'IT',
              language: language,
              notifications: {
                price_change_threshold: 10,
                recurring_order_reminder_days: 3,
                enable_price_alerts: true,
                enable_recurring_reminders: true,
              },
            });
          } catch (err) {
            console.warn('Could not save initial settings:', err);
          }
          
          toast.success(t('registrationComplete'));
          setIsLogin(true);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(t('authError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Language Selector - BEFORE the login form */}
        <Card className="bg-white border-2 border-purple-200 shadow-xl">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Label htmlFor="language-select" className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Languages className="h-5 w-5 text-purple-600" />
                {t('selectLanguage')}
              </Label>
              <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
                <SelectTrigger 
                  id="language-select" 
                  className="w-full border-2 border-purple-200 hover:border-purple-400 focus:border-purple-500 rounded-xl h-12 text-base font-medium bg-white shadow-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-purple-200">
                  {languageOptions.map((option) => (
                    <SelectItem 
                      key={option.value} 
                      value={option.value}
                      className="text-base cursor-pointer hover:bg-purple-50"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Login/Register Card */}
        <Card className="bg-white border-2 border-purple-200 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {isLogin ? t('loginTitle') : t('registerTitle')}
            </CardTitle>
            <CardDescription className="text-center text-slate-600">
              {isLogin ? t('loginDescription') : t('registerDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-2 focus:border-purple-500 rounded-xl"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 border-2 focus:border-purple-500 rounded-xl"
                    disabled={isLoading}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700">{t('confirmPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder={t('confirmPasswordPlaceholder')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 border-2 focus:border-purple-500 rounded-xl"
                      disabled={isLoading}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  t('loading')
                ) : isLogin ? (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    {t('loginButton')}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t('registerButton')}
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                disabled={isLoading}
              >
                {isLogin ? t('noAccount') : t('hasAccount')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}