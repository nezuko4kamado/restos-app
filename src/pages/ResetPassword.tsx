import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Footer } from '@/components/Footer';
import { Lock, CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/utils/passwordValidation';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    // ✅ Supabase sends recovery tokens as URL hash fragments:
    // e.g., #access_token=...&refresh_token=...&type=recovery
    // We need to wait for Supabase's onAuthStateChange to process these tokens
    // before checking the session.

    const hash = window.location.hash;
    const hasRecoveryTokens = hash.includes('access_token') || hash.includes('type=recovery');

    console.log('🔑 [RESET] Page loaded, hash present:', !!hash, 'has recovery tokens:', hasRecoveryTokens);

    if (hasRecoveryTokens) {
      // Wait for Supabase to process the hash tokens via onAuthStateChange
      console.log('🔑 [RESET] Recovery tokens detected in URL, waiting for auth state change...');

      let resolved = false;

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔑 [RESET] Auth state change:', event, !!session);

        if (resolved) return;

        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          resolved = true;
          console.log('✅ [RESET] Recovery session established via event:', event);
          setIsValidSession(true);
          setChecking(false);
          subscription.unsubscribe();
        }
      });

      // Timeout: if no auth event fires within 10 seconds, check session directly
      const timeout = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
        console.log('⏰ [RESET] Timeout reached, checking session directly...');
        subscription.unsubscribe();

        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            console.log('✅ [RESET] Session found after timeout');
            setIsValidSession(true);
          } else {
            console.log('❌ [RESET] No session found after timeout');
            setError('Sessione di recupero non valida o scaduta. Richiedi un nuovo link di recupero.');
          }
        } catch (err) {
          console.error('❌ [RESET] Error checking session:', err);
          setError('Errore nella verifica della sessione. Riprova.');
        }
        setChecking(false);
      }, 10000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    } else {
      // No recovery tokens in URL - check if there's already an active session
      // (e.g., user navigated here directly)
      console.log('🔑 [RESET] No recovery tokens in URL, checking existing session...');

      const checkExistingSession = async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            console.log('✅ [RESET] Existing session found');
            setIsValidSession(true);
          } else {
            console.log('❌ [RESET] No session found');
            setError('Sessione di recupero non valida o scaduta. Richiedi un nuovo link di recupero.');
          }
        } catch (err) {
          console.error('❌ [RESET] Error checking session:', err);
          setError('Errore nella verifica della sessione. Riprova.');
        }
        setChecking(false);
      };

      checkExistingSession();
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono');
      toast.error('Le password non coincidono');
      return;
    }

    // Validate password strength
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setError('La password non soddisfa tutti i requisiti di sicurezza');
      toast.error('La password non soddisfa tutti i requisiti di sicurezza');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      toast.success('Password aggiornata con successo!');

      // Sign out after password reset so user logs in with new password
      await supabase.auth.signOut();

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Password reset error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Errore durante il reset della password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Loading state while checking session
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="p-8 bg-white border-none shadow-xl max-w-md w-full">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
            <p className="text-center mt-4 text-gray-600">Verifica sessione in corso...</p>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="p-8 bg-white border-none shadow-xl max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Reimposta Password
            </h1>
            <p className="text-gray-600">Crea una nuova password sicura per il tuo account</p>
          </div>

          {success ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-sm text-gray-700 ml-2">
                <strong>Password aggiornata con successo!</strong>
                <p className="mt-1">Verrai reindirizzato alla pagina di login tra pochi secondi...</p>
              </AlertDescription>
            </Alert>
          ) : error && !isValidSession ? (
            <div className="space-y-4">
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-sm ml-2">{error}</AlertDescription>
              </Alert>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Torna al Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="text-sm ml-2">{error}</AlertDescription>
                </Alert>
              )}

              {/* New Password Field */}
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-gray-700 font-medium">
                  Nuova Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && <PasswordStrengthIndicator password={newPassword} />}

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-700 font-medium">
                  Conferma Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    disabled={loading}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <X className="h-4 w-4" />
                    Le password non coincidono
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-base shadow-lg hover:shadow-xl transition-all"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Aggiornamento...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    <span>Reimposta Password</span>
                  </div>
                )}
              </Button>

              {/* Back to Login */}
              <div className="text-center pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm text-purple-600 hover:text-purple-700 hover:underline font-medium"
                  disabled={loading}
                >
                  Torna al Login
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}