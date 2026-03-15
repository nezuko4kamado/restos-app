import { supabase } from '@/lib/supabase';

export function useAdmin() {
  const syncWithStripe = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/sync-stripe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync with Stripe');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error syncing with Stripe:', error);
      throw error;
    }
  };

  return {
    syncWithStripe,
  };
}