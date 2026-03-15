import { supabase } from './supabase';
import { toast } from 'sonner';

export interface SubscriptionLimits {
  subscription_type: 'free' | 'basic' | 'pro' | 'premium';
  invoices_this_month: number;
  invoices_limit: number;
  scans_used: number;
  scans_limit: number;
  products_saved: number;
  products_limit: number;
  status: string;
}

export const PLAN_LIMITS = {
  free: { invoices: 10, scans: 10, products: 20 },
  basic: { invoices: 20, scans: 20, products: 40 },
  pro: { invoices: 50, scans: 50, products: 100 },
  premium: { invoices: -1, scans: -1, products: -1 } // -1 = unlimited
};

export class SubscriptionService {
  /**
   * Get current user's subscription limits
   */
  static async getSubscriptionLimits(): Promise<SubscriptionLimits | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ No user logged in');
        return null;
      }

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('❌ Error fetching subscription:', error);
        return null;
      }

      return data as SubscriptionLimits;
    } catch (error) {
      console.error('❌ Exception in getSubscriptionLimits:', error);
      return null;
    }
  }

  /**
   * Check if user can upload more invoices
   */
  static async canUploadInvoice(): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
    percentage: number;
  }> {
    const limits = await this.getSubscriptionLimits();
    
    if (!limits) {
      return {
        allowed: false,
        reason: 'Impossibile verificare il piano di abbonamento',
        current: 0,
        limit: 0,
        percentage: 0
      };
    }

    const { invoices_this_month, invoices_limit } = limits;
    
    // Premium = unlimited
    if (invoices_limit === -1) {
      return {
        allowed: true,
        current: invoices_this_month,
        limit: -1,
        percentage: 0
      };
    }

    const percentage = (invoices_this_month / invoices_limit) * 100;
    
    if (invoices_this_month >= invoices_limit) {
      return {
        allowed: false,
        reason: `Hai raggiunto il limite di ${invoices_limit} fatture per questo mese`,
        current: invoices_this_month,
        limit: invoices_limit,
        percentage: 100
      };
    }

    return {
      allowed: true,
      current: invoices_this_month,
      limit: invoices_limit,
      percentage
    };
  }

  /**
   * Increment invoice count after successful upload
   */
  static async incrementInvoiceCount(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase.rpc('increment_invoice_count', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error incrementing invoice count:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Exception incrementing invoice count:', error);
      return false;
    }
  }

  /**
   * Get usage badge color based on percentage
   */
  static getUsageBadgeColor(percentage: number): string {
    if (percentage < 50) return 'bg-green-100 text-green-700 border-green-300';
    if (percentage < 80) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-red-100 text-red-700 border-red-300';
  }

  /**
   * Show usage warning if approaching limit
   */
  static showUsageWarning(current: number, limit: number): void {
    if (limit === -1) return; // Unlimited

    const percentage = (current / limit) * 100;
    
    if (percentage >= 80 && percentage < 100) {
      toast.warning(`⚠️ Attenzione: hai utilizzato ${current} di ${limit} fatture (${Math.round(percentage)}%)`, {
        duration: 5000
      });
    }
  }

  /**
   * Show limit reached error with upgrade option
   */
  static showLimitReachedError(current: number, limit: number, onUpgrade: () => void): void {
    toast.error(
      `🚫 Limite raggiunto: ${current}/${limit} fatture utilizzate questo mese`,
      {
        duration: 8000,
        action: {
          label: 'Aggiorna Piano',
          onClick: onUpgrade
        }
      }
    );
  }
}