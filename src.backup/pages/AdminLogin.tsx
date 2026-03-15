import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Footer } from '@/components/Footer';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Admin credentials - Using email-based authentication as requested
const ADMIN_CREDENTIALS = {
  email: 'salvo89uk@gmail.com',
  password: 'Nisseno89'
};

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      // Save admin session to localStorage
      const session = {
        authenticated: true,
        timestamp: Date.now(),
        username: email
      };
      localStorage.setItem('admin_session', JSON.stringify(session));
      
      toast.success('✅ Login successful! Redirecting...');
      
      // Redirect to admin panel
      setTimeout(() => {
        navigate('/admin');
      }, 500);
    } else {
      setError('Invalid email or password');
      toast.error('❌ Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-2 border-indigo-200 shadow-2xl">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl">
                <Shield className="h-12 w-12 text-white" />
              </div>
            </div>
            <div className="text-center">
              <CardTitle className="text-3xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Admin Login
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Enter your credentials to access the admin panel
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2" />
                    Login
                  </>
                )}
              </Button>

              <div className="pt-4 border-t">
                <p className="text-xs text-center text-slate-500">
                  For security reasons, admin access is restricted.
                  <br />
                  Contact the system administrator if you need access.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}