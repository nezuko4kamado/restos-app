import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email) {
      setError(t.enterYourEmail || 'Enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError(t.enterValidEmail || 'Enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
      toast.success(t.recoveryEmailSent || 'Recovery email sent successfully!');
      
      // Close dialog after 3 seconds
      setTimeout(() => {
        onOpenChange(false);
        setEmail('');
        setSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Password reset error:', error);
      const errorMessage = error instanceof Error ? error.message : (t.errorSendingEmail || 'Error sending email');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setEmail('');
      setError(null);
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t.recoverPassword || 'Recover Password'}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {t.resetPasswordDescription || 'Enter your email address and we will send you a link to reset your password.'}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-gray-700 ml-2">
              <strong>{t.emailSentSuccess || 'Email sent successfully!'}</strong>
              <p className="mt-1">
                {t.checkEmailInstructions || 'Check your inbox and follow the instructions to reset your password.'}
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm ml-2">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-gray-700 font-medium">
                {t.emailAddress || 'Email Address'}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder={t.emailPlaceholder || 'tuo@email.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                {t.cancel || 'Cancel'}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t.sending || 'Sending...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <span>{t.sendEmail || 'Send Email'}</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            {t.emailNotReceived || "💡 Didn't receive the email? Check your spam folder or try again in a few minutes."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}