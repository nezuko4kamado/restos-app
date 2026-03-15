import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Mail, Lock, LogIn, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { RegisterForm } from '@/components/RegisterForm';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language, languageOptions } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  
  // Use the language context
  const { language, setLanguage, t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(t.enterEmailPassword);
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        console.error('Login error:', error);
        toast.error(error.message || t.authError);
        return;
      }
      
      // Save language to localStorage
      const existingSettings = localStorage.getItem('restaurant_settings');
      const settings = existingSettings ? JSON.parse(existingSettings) : {};
      settings.language = language;
      localStorage.setItem('restaurant_settings', JSON.stringify(settings));
      
      toast.success(t.success);
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : t.authError;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSuccess = () => {
    // Save language to localStorage
    const existingSettings = localStorage.getItem('restaurant_settings');
    const settings = existingSettings ? JSON.parse(existingSettings) : {};
    settings.language = language;
    localStorage.setItem('restaurant_settings', JSON.stringify(settings));
    
    navigate('/');
  };

  const handleSwitchToLogin = () => {
    setShowRegister(false);
  };

  const getForgotPasswordText = () => {
    switch (language) {
      case 'it': return 'Hai dimenticato la password?';
      case 'en': return 'Forgot password?';
      case 'es': return '¿Olvidaste tu contraseña?';
      case 'fr': return 'Mot de passe oublié ?';
      case 'de': return 'Passwort vergessen?';
      case 'lt': return 'Pamiršote slaptažodį?';
      default: return 'Forgot password?';
    }
  };

  const getPasswordLabel = () => {
    switch (language) {
      case 'it': return 'Password';
      case 'en': return 'Password';
      case 'es': return 'Contraseña';
      case 'fr': return 'Mot de passe';
      case 'de': return 'Passwort';
      case 'lt': return 'Slaptažodis';
      default: return 'Password';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Language Selector */}
          <Card className="p-6 bg-white border-none shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="h-5 w-5 text-purple-600" />
              <Label className="text-base font-semibold text-gray-700">{t.selectLanguage}</Label>
            </div>
            <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
              <SelectTrigger className="w-full border-gray-300">
                <SelectValue placeholder={t.selectLanguage} />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Login/Register Card */}
          <Card className="p-8 bg-white border-none shadow-xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                {showRegister ? t.registerTitle : t.loginTitle}
              </h1>
              <p className="text-gray-600">
                {showRegister ? t.registerDescription : t.loginDescription}
              </p>
            </div>

            {showRegister ? (
              <RegisterForm
                onSuccess={handleRegisterSuccess}
                onSwitchToLogin={handleSwitchToLogin}
              />
            ) : (
              <div className="space-y-6">
                {/* Email/Password Login Form */}
                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                      {t.email}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder={t.emailPlaceholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700 font-medium">
                      {getPasswordLabel()}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder={t.passwordPlaceholder}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Login Button */}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-base shadow-lg hover:shadow-xl transition-all"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>{t.loading}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <LogIn className="h-5 w-5" />
                        <span>{t.loginButton}</span>
                      </div>
                    )}
                  </Button>

                  {/* Forgot Password Link */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 hover:underline font-medium transition-colors"
                      disabled={loading}
                    >
                      {getForgotPasswordText()}
                    </button>
                  </div>

                  {/* Register Link */}
                  <div className="text-center pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowRegister(true)}
                      className="text-purple-600 hover:text-purple-700 hover:underline cursor-pointer font-medium"
                      disabled={loading}
                    >
                      {t.noAccount}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog 
        open={showForgotPassword} 
        onOpenChange={setShowForgotPassword}
      />
    </div>
  );
}