import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, User, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { signUp } from '@/lib/supabase';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/utils/passwordValidation';
import { useLanguage } from '@/contexts/LanguageContext';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.log('🟢 [REGISTER FORM] Starting registration process...');

    // Validate all fields
    if (!fullName.trim()) {
      setError(t.enterFullName || 'Enter your full name');
      toast.error(t.enterFullName || 'Enter your full name');
      return;
    }

    if (!email || !validateEmail(email)) {
      setError(t.enterValidEmail || 'Enter a valid email address');
      toast.error(t.enterValidEmail || 'Enter a valid email address');
      return;
    }

    if (!password) {
      setError(t.enterPassword || 'Enter a password');
      toast.error(t.enterPassword || 'Enter a password');
      return;
    }

    // Validate password strength
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError(t.passwordNotMeetRequirements || 'Password does not meet all security requirements');
      toast.error(t.passwordNotMeetRequirements || 'Password does not meet all security requirements');
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t.passwordsDontMatch || 'Passwords do not match');
      toast.error(t.passwordsDontMatch || 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      console.log('🟢 [REGISTER FORM] Calling signUp with:', { email, fullName });
      
      // Sign up user
      const { data, error: signUpError } = await signUp(email, password, {
        full_name: fullName.trim(),
      });

      console.log('🟢 [REGISTER FORM] signUp returned:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        hasError: !!signUpError,
        errorMessage: signUpError?.message,
        errorCode: signUpError?.code,
      });

      if (signUpError) {
        console.error('🔴 [REGISTER FORM] Registration error:', signUpError);
        console.error('🔴 [REGISTER FORM] Error details:', JSON.stringify(signUpError, null, 2));
        
        // Provide more specific error messages
        let errorMessage = signUpError.message;
        
        if (signUpError.message.includes('Database error')) {
          errorMessage = t.databaseErrorRegistration || 'Database error during registration. Check logs for more details.';
          console.error('🔴 [REGISTER FORM] DATABASE ERROR - Check Supabase logs and trigger configuration');
        } else if (signUpError.message.includes('User already registered')) {
          errorMessage = t.emailAlreadyRegistered || 'This email address is already registered. Try logging in or use another email.';
        } else if (signUpError.message.includes('Invalid email')) {
          errorMessage = t.invalidEmail || 'Invalid email address.';
        } else if (signUpError.message.includes('Password')) {
          errorMessage = t.passwordNotMeetRequirements || 'Password does not meet security requirements.';
        }
        
        throw new Error(errorMessage);
      }

      if (data.user) {
        console.log('🟢 [REGISTER FORM] User created successfully:', data.user.id);
        toast.success(t.registrationComplete || 'Registration completed successfully!');
        
        // Check if email confirmation is required
        if (data.session) {
          // Auto-login successful
          console.log('🟢 [REGISTER FORM] Session created, auto-login successful');
          toast.success(t.autoLoginSuccess || 'Logged in automatically!');
          if (onSuccess) {
            onSuccess();
          } else {
            navigate('/');
          }
        } else {
          // Email confirmation required
          console.log('🟢 [REGISTER FORM] Email confirmation required');
          toast.info(t.emailConfirmationNotice || 'Check your email to confirm your account');
          setTimeout(() => {
            if (onSwitchToLogin) {
              onSwitchToLogin();
            } else {
              navigate('/login');
            }
          }, 2000);
        }
      } else {
        console.error('🔴 [REGISTER FORM] No user data returned but no error either');
        throw new Error(t.registrationFailed || 'Registration failed: no user data returned');
      }
    } catch (error) {
      console.error('🔴 [REGISTER FORM] Caught error:', error);
      console.error('🔴 [REGISTER FORM] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      
      const errorMessage =
        error instanceof Error ? error.message : (t.registrationError || 'Error during registration');
      
      console.error('🔴 [REGISTER FORM] Final error message:', errorMessage);
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      console.log('🟢 [REGISTER FORM] Registration process completed');
    }
  };

  return (
    <form onSubmit={handleRegister} className="space-y-6">
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-sm ml-2">{error}</AlertDescription>
        </Alert>
      )}

      {/* Full Name Field */}
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-gray-700 font-medium">
          {t.fullName || 'Full Name'}
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            id="fullName"
            type="text"
            placeholder={t.fullNamePlaceholder || 'Mario Rossi'}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
            disabled={loading}
            autoFocus
          />
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="register-email" className="text-gray-700 font-medium">
          {t.email || 'Email'}
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            id="register-email"
            type="email"
            placeholder={t.emailPlaceholder || 'tuo@email.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
            disabled={loading}
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="register-password" className="text-gray-700 font-medium">
          {t.password || 'Password'}
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            id="register-password"
            type="password"
            placeholder={t.passwordPlaceholder || '••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
            disabled={loading}
          />
        </div>
      </div>

      {/* Password Strength Indicator */}
      {password && <PasswordStrengthIndicator password={password} />}

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-gray-700 font-medium">
          {t.confirmPassword || 'Confirm Password'}
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            id="confirm-password"
            type="password"
            placeholder={t.confirmPasswordPlaceholder || '••••••••'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
            disabled={loading}
          />
        </div>
        {confirmPassword && password !== confirmPassword && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {t.passwordsDontMatch || 'Passwords do not match'}
          </p>
        )}
      </div>

      {/* Register Button */}
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-base shadow-lg hover:shadow-xl transition-all"
        disabled={loading || !fullName || !email || !password || !confirmPassword}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>{t.registering || 'Registering...'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            <span>{t.registerButton || 'Register'}</span>
          </div>
        )}
      </Button>

      {/* Switch to Login */}
      {onSwitchToLogin && (
        <div className="text-center pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-purple-600 hover:text-purple-700 hover:underline cursor-pointer font-medium"
            disabled={loading}
          >
            {t.hasAccount || 'Already have an account? Login'}
          </button>
        </div>
      )}
    </form>
  );
}