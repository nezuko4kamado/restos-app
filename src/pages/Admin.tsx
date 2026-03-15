import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Footer } from '@/components/Footer';
import { Shield, UserCheck, UserX, Loader2, AlertCircle, Crown, LogOut, RefreshCw, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations, getLanguage } from '@/lib/i18n';
import { loadSettings, saveSettings } from '@/lib/storage';
import type { Settings } from '@/types';

interface UserSubscription {
  user_id: string;
  email: string;
  subscription_type: 'free_lifetime' | 'trial' | 'paid';
  status: string;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminSession {
  authenticated: boolean;
  timestamp: number;
  username: string;
}

export default function Admin() {
  const [users, setUsers] = useState<UserSubscription[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [processingEmail, setProcessingEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { syncWithStripe: syncStripeAPI } = useAdmin();
  const t = useTranslations(getLanguage());

  useEffect(() => {
    checkAdminSession();
  }, []);

  useEffect(() => {
    if (adminUsername) {
      fetchUsers();
    }
  }, [adminUsername]);

  useEffect(() => {
    applyFilters();
  }, [users, filter, searchQuery]);

  const checkAdminSession = async () => {
    try {
      // Load admin session from Supabase
      const settings = await loadSettings();
      const sessionData = (settings as Settings & { admin_session?: AdminSession }).admin_session;
      
      if (!sessionData) {
        navigate('/admin/login');
        return;
      }

      const session: AdminSession = sessionData;
      
      // Check if session is valid (not older than 24 hours)
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const isExpired = Date.now() - session.timestamp > twentyFourHours;
      
      if (!session.authenticated || isExpired) {
        // Clear admin session from Supabase
        const updatedSettings = { ...settings } as Settings & { admin_session?: AdminSession };
        delete updatedSettings.admin_session;
        await saveSettings(updatedSettings);
        
        toast.error('Session expired. Please login again.');
        navigate('/admin/login');
        return;
      }

      setAdminUsername(session.username);
    } catch (error) {
      console.error('Error checking admin session:', error);
      navigate('/admin/login');
    }
  };

  const handleLogout = async () => {
    try {
      // Remove admin session from Supabase
      const settings = await loadSettings();
      const updatedSettings = { ...settings } as Settings & { admin_session?: AdminSession };
      delete updatedSettings.admin_session;
      await saveSettings(updatedSettings);
      
      toast.success('Logged out successfully');
      navigate('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
      navigate('/admin/login');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all user subscriptions with user emails
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          subscription_type,
          status,
          trial_end,
          current_period_start,
          current_period_end,
          stripe_customer_id,
          stripe_subscription_id,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user emails from auth.users
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error('Error fetching auth users:', authError);
        // Continue with data we have
      }

      // Merge subscription data with emails
      const usersWithEmails = data?.map(sub => {
        const authUser = authUsers?.users.find(u => u.id === sub.user_id);
        return {
          ...sub,
          email: authUser?.email || 'Unknown',
        };
      }) || [];

      setUsers(usersWithEmails);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const syncWithStripe = async () => {
    try {
      setSyncing(true);
      toast.info('🔄 Syncing with Stripe...');

      // Call the Stripe sync API
      const result = await syncStripeAPI();
      
      // Refresh the user list
      await fetchUsers();
      
      toast.success(`✅ ${result.message}`);
    } catch (error) {
      console.error('Error syncing with Stripe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync with Stripe';
      
      // If Stripe is not configured, just refresh the data
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        toast.info('Stripe sync function not deployed. Refreshing data from database...');
        await fetchUsers();
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSyncing(false);
    }
  };

  const applyFilters = () => {
    let filtered = users;

    // Apply subscription type filter
    if (filter !== 'all') {
      filtered = filtered.filter(user => user.subscription_type === filter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(query) ||
        user.stripe_customer_id?.toLowerCase().includes(query) ||
        user.stripe_subscription_id?.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  };

  const grantLifetimeAccess = async (email: string) => {
    try {
      setProcessingEmail(email);
      
      const { error } = await supabase.rpc('grant_free_lifetime', {
        user_email: email
      });

      if (error) throw error;

      toast.success(`✅ Lifetime access granted to ${email}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error granting lifetime access:', error);
      toast.error('Failed to grant lifetime access');
    } finally {
      setProcessingEmail(null);
    }
  };

  const revokeLifetimeAccess = async (email: string) => {
    try {
      setProcessingEmail(email);
      
      const { error } = await supabase.rpc('revoke_free_lifetime', {
        user_email: email
      });

      if (error) throw error;

      toast.success(`🔒 Lifetime access revoked for ${email}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error revoking lifetime access:', error);
      toast.error('Failed to revoke lifetime access');
    } finally {
      setProcessingEmail(null);
    }
  };

  const activateSubscription = async (userId: string, email: string) => {
    try {
      setProcessingEmail(email);
      
      // Update subscription to active/paid status
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          subscription_type: 'paid',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`✅ Subscription activated for ${email}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error activating subscription:', error);
      toast.error('Failed to activate subscription');
    } finally {
      setProcessingEmail(null);
    }
  };

  const deactivateSubscription = async (userId: string, email: string) => {
    try {
      setProcessingEmail(email);
      
      // Update subscription to canceled status
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          subscription_type: 'trial',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`🔒 Subscription deactivated for ${email}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error deactivating subscription:', error);
      toast.error('Failed to deactivate subscription');
    } finally {
      setProcessingEmail(null);
    }
  };

  const getSubscriptionBadge = (type: string) => {
    switch (type) {
      case 'free_lifetime':
        return <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white"><Crown className="h-3 w-3 mr-1" />Lifetime</Badge>;
      case 'paid':
        return <Badge className="bg-green-600">Paid</Badge>;
      case 'trial':
        return <Badge variant="secondary">Trial</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-600">Trialing</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Canceled</Badge>;
      case 'past_due':
        return <Badge className="bg-orange-600">Past Due</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <Card className="border-2 border-indigo-200 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Admin Panel
                    </CardTitle>
                    <CardDescription className="text-base mt-1">
                      Manage user subscriptions and Stripe integrations
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('logout')}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Current Admin Info */}
          <Alert className="border-blue-200 bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-slate-700 ml-2">
              {t('connectedAs')}: <strong>{adminUsername}</strong>
            </AlertDescription>
          </Alert>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-indigo-600">{users.length}</div>
                <div className="text-sm text-slate-600">Total Users</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.subscription_type === 'paid').length}
                </div>
                <div className="text-sm text-slate-600">Paid Subscriptions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">
                  {users.filter(u => u.subscription_type === 'free_lifetime').length}
                </div>
                <div className="text-sm text-slate-600">Lifetime Access</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.subscription_type === 'trial').length}
                </div>
                <div className="text-sm text-slate-600">Trial Users</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters & Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by email or Stripe ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>
                
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users ({users.length})</SelectItem>
                    <SelectItem value="free_lifetime">
                      Lifetime ({users.filter(u => u.subscription_type === 'free_lifetime').length})
                    </SelectItem>
                    <SelectItem value="paid">
                      Paid ({users.filter(u => u.subscription_type === 'paid').length})
                    </SelectItem>
                    <SelectItem value="trial">
                      Trial ({users.filter(u => u.subscription_type === 'trial').length})
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={syncWithStripe}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Stripe
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchUsers}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <CardDescription>Manage user subscriptions, Stripe data, and access controls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stripe Customer</TableHead>
                      <TableHead>Period End</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                          {searchQuery ? 'No users found matching your search' : 'No users found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{getSubscriptionBadge(user.subscription_type)}</TableCell>
                          <TableCell>{getStatusBadge(user.status)}</TableCell>
                          <TableCell className="text-xs">
                            {user.stripe_customer_id ? (
                              <a
                                href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                              >
                                {user.stripe_customer_id.substring(0, 12)}...
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {formatDate(user.current_period_end)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {formatDate(user.updated_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user.subscription_type !== 'free_lifetime' && (
                                <>
                                  {user.status !== 'active' || user.subscription_type !== 'paid' ? (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => activateSubscription(user.user_id, user.email)}
                                      disabled={processingEmail === user.email}
                                    >
                                      {processingEmail === user.email ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <UserCheck className="h-4 w-4 mr-1" />
                                          Activate
                                        </>
                                      )}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-red-200 hover:bg-red-50"
                                      onClick={() => deactivateSubscription(user.user_id, user.email)}
                                      disabled={processingEmail === user.email}
                                    >
                                      {processingEmail === user.email ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <UserX className="h-4 w-4 mr-1" />
                                          Deactivate
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                                    onClick={() => grantLifetimeAccess(user.email)}
                                    disabled={processingEmail === user.email}
                                  >
                                    {processingEmail === user.email ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Crown className="h-4 w-4 mr-1" />
                                        Grant Lifetime
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                              {user.subscription_type === 'free_lifetime' && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => revokeLifetimeAccess(user.email)}
                                  disabled={processingEmail === user.email}
                                >
                                  {processingEmail === user.email ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserX className="h-4 w-4 mr-1" />
                                      Revoke Lifetime
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Integration Info */}
          <Alert className="border-indigo-200 bg-indigo-50">
            <AlertCircle className="h-4 w-4 text-indigo-600" />
            <AlertDescription className="text-sm text-slate-700 ml-2">
              <strong>Stripe Integration:</strong> The app uses recurring subscriptions (€9.90/month). 
              Webhook events automatically update subscription status. Use "Sync Stripe" to manually refresh data from Stripe API.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}