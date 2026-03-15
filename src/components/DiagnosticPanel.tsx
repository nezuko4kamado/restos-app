import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Cloud, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { isSupabaseConfigured, getCurrentUser } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function DiagnosticPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);

  const checkStatus = async () => {
    setIsRefreshing(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setSupabaseConfigured(isSupabaseConfigured());
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const StatusIcon = ({ status }: { status: 'success' | 'error' | 'warning' }) => {
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'error') return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                System Diagnostics
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">Application status and configuration</p>
            </div>
          </div>
          <Button
            onClick={checkStatus}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Storage Mode */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-semibold text-slate-800">Storage Mode</p>
                <p className="text-sm text-slate-600">Data persistence layer</p>
              </div>
            </div>
            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              Supabase Only
            </Badge>
          </div>
        </div>

        {/* Supabase Configuration */}
        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-semibold text-slate-800">Supabase Configuration</p>
                <p className="text-sm text-slate-600">Cloud database connection</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status={supabaseConfigured ? 'success' : 'error'} />
              <Badge variant={supabaseConfigured ? 'default' : 'destructive'}>
                {supabaseConfigured ? 'Connected' : 'Not Configured'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Authentication Status */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-slate-800">Authentication</p>
                <p className="text-sm text-slate-600">
                  {user ? `Logged in as ${user.email}` : 'Not authenticated'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon status={user ? 'success' : 'warning'} />
              <Badge variant={user ? 'default' : 'secondary'}>
                {user ? 'Authenticated' : 'Guest'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-2 border-slate-200">
          <p className="text-sm text-slate-700">
            <strong>ℹ️ Note:</strong> This application now uses <strong>Supabase exclusively</strong> for data storage. 
            All data (products, suppliers, orders, invoices, and settings) is stored in the cloud and synced across devices.
            localStorage is no longer used for any data persistence.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}