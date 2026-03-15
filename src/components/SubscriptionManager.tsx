import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, ExternalLink, Clock, AlertTriangle, Shield, Zap, Crown, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useLanguage } from '@/lib/i18n'
import { getCurrencySymbol } from '@/lib/currency'
import { useSettings } from '@/hooks/useSettings'

// ✅ CRITICAL: Must match the actual invoices table name used in storage.ts
const INVOICES_TABLE = 'app_43909_invoices'

interface PlanLimits {
  products: number
  invoicesPerMonth: number
}

interface Plan {
  name: string
  price: string
  priceId: string
  type: string
  limits: PlanLimits
  scansLimit: number
  features: string[]
  popular?: boolean
  icon: React.ReactNode
}

interface SubscriptionData {
  id: string
  subscription_type: string
  status: string
  scans_used: number
  scans_limit: number
  products_saved: number
  products_limit: number
  invoices_this_month: number
  invoices_limit: number
  stripe_customer_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

// Default free tier data used when no DB record exists
const FREE_TIER_DEFAULTS: SubscriptionData = {
  id: 'free-default',
  subscription_type: 'free',
  status: 'active',
  scans_used: 0,
  scans_limit: 10,
  products_saved: 0,
  products_limit: 20,
  invoices_this_month: 0,
  invoices_limit: 10,
  stripe_customer_id: null,
  current_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString(),
  cancel_at_period_end: false,
}

// Map language code to locale string for date formatting
const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  it: 'it-IT',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  lt: 'lt-LT',
}

export function SubscriptionManager() {
  const { t, language } = useLanguage()
  const { toast } = useToast()
  const { settings } = useSettings()
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionData | null>(null)
  const [daysUntilRenewal, setDaysUntilRenewal] = useState<number>(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const autoSyncDone = useRef(false)
  
  // Get currency from settings
  const currency = settings.defaultCurrency || 'EUR'
  const currencySymbol = getCurrencySymbol(currency)

  // Get the locale string for the current language
  const dateLocale = LANGUAGE_LOCALE_MAP[language] || 'it-IT'

  // Define plans with proper price IDs
  const plans: Plan[] = useMemo(() => [
    {
      name: 'Free',
      price: '0',
      priceId: '',
      type: 'free',
      limits: {
        products: 20,
        invoicesPerMonth: 10
      },
      scansLimit: 10,
      features: [
        t('subscriptions.scansTotal').replace('{{count}}', '10'),
        t('subscriptions.emailSupport'),
        '20 ' + t('subscriptions.products'),
        '10 ' + t('subscriptions.invoices')
      ],
      icon: <Shield className="h-5 w-5" />
    },
    {
      name: 'Basic',
      price: '9.99',
      priceId: 'price_1Sro9hERHOOWoH8ZAusBoEDS',
      type: 'basic',
      limits: {
        products: 40,
        invoicesPerMonth: 20
      },
      scansLimit: 20,
      features: [
        t('subscriptions.scansPerMonth').replace('{{count}}', '20'),
        t('subscriptions.emailSupport'),
        '40 ' + t('subscriptions.products'),
        '20 ' + t('subscriptions.invoices')
      ],
      icon: <Zap className="h-5 w-5" />
    },
    {
      name: 'Pro',
      price: '19.99',
      priceId: 'price_1SroFeERHOOWoH8ZzKxaihdT',
      type: 'pro',
      limits: {
        products: 100,
        invoicesPerMonth: 50
      },
      scansLimit: 50,
      features: [
        t('subscriptions.scansPerMonth').replace('{{count}}', '50'),
        t('subscriptions.prioritySupport'),
        '100 ' + t('subscriptions.products'),
        '50 ' + t('subscriptions.invoices')
      ],
      popular: true,
      icon: <Zap className="h-5 w-5" />
    },
    {
      name: 'Premium',
      price: '49.99',
      priceId: 'price_1SroIRERHOOWoH8Zyi6tTBGy',
      type: 'premium',
      limits: {
        products: -1,
        invoicesPerMonth: -1
      },
      scansLimit: -1,
      features: [
        t('subscriptions.unlimitedScans'),
        t('subscriptions.dedicatedSupport'),
        t('subscriptions.unlimitedProducts'),
        t('subscriptions.unlimitedInvoices')
      ],
      icon: <Crown className="h-5 w-5" />
    }
  ], [t, language])

  /**
   * Sync subscription with Stripe via edge function
   */
  const syncSubscription = useCallback(async (silent = false): Promise<boolean> => {
    setSyncing(true)
    try {
      console.log('🔄 [SYNC] Invoking sync-user-subscription edge function...')
      const { data, error } = await supabase.functions.invoke('sync-user-subscription')

      if (error) {
        console.error('❌ [SYNC] Edge function error:', error)
        if (!silent) {
          toast({
            title: t('subscriptions.syncError'),
            description: error.message || 'Failed to sync subscription',
            variant: 'destructive',
          })
        }
        return false
      }

      console.log('✅ [SYNC] Sync result:', data)

      if (data?.synced) {
        if (!silent) {
          toast({
            title: t('subscriptions.syncSuccess'),
            description: `${t('subscriptions.planUpdatedTo')} ${data.plan?.toUpperCase() || 'updated'}`,
          })
        }
        // Reload subscription data
        await loadSubscriptionData(true)
        return true
      } else {
        if (!silent) {
          toast({
            title: t('subscriptions.syncNoChanges'),
            description: data?.message || 'No changes detected',
          })
        }
        return false
      }
    } catch (err) {
      console.error('❌ [SYNC] Error:', err)
      if (!silent) {
        toast({
          title: t('subscriptions.syncError'),
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        })
      }
      return false
    } finally {
      setSyncing(false)
    }
  }, [t, toast])

  /**
   * Enrich subscription data with actual counts from products, invoices, and scans.
   */
  const enrichWithActualCounts = async (
    subData: SubscriptionData,
    userId: string
  ): Promise<SubscriptionData> => {
    let actualProducts = subData.products_saved
    let actualInvoices = subData.invoices_this_month
    let actualScans = subData.scans_used || 0

    try {
      // ── Count products ──
      const { count: productsCount, error: prodErr } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (!prodErr && productsCount !== null && productsCount !== undefined) {
        actualProducts = productsCount
        console.log('[SubscriptionManager] Products count (head):', productsCount)
      } else {
        console.warn('[SubscriptionManager] Products head count failed, using fallback. Error:', prodErr?.message)
        const { data: productRows, error: prodFallbackErr } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)

        if (!prodFallbackErr && productRows) {
          actualProducts = productRows.length
          console.log('[SubscriptionManager] Products count (fallback):', productRows.length)
        }
      }

      // ── Count invoices ──
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      if (subData.subscription_type === 'free') {
        // Free tier: count ALL invoices (total, not monthly)
        const { count: totalInvCount, error: totalInvErr } = await supabase
          .from(INVOICES_TABLE)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (!totalInvErr && totalInvCount !== null && totalInvCount !== undefined) {
          actualInvoices = totalInvCount
        } else {
          const { data: invRows, error: invFallbackErr } = await supabase
            .from(INVOICES_TABLE)
            .select('id')
            .eq('user_id', userId)

          if (!invFallbackErr && invRows) {
            actualInvoices = invRows.length
          }
        }
      } else {
        // Paid plans: count invoices this month only
        const { count: monthlyInvCount, error: monthlyInvErr } = await supabase
          .from(INVOICES_TABLE)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        if (!monthlyInvErr && monthlyInvCount !== null && monthlyInvCount !== undefined) {
          actualInvoices = monthlyInvCount
        } else {
          const { data: invRows, error: invFallbackErr } = await supabase
            .from(INVOICES_TABLE)
            .select('id')
            .eq('user_id', userId)
            .gte('created_at', startOfMonth)
            .lte('created_at', endOfMonth)

          if (!invFallbackErr && invRows) {
            actualInvoices = invRows.length
          }
        }
      }

      // ── Scans: re-read from DB ──
      const { data: freshSub, error: freshSubErr } = await supabase
        .from('user_subscriptions')
        .select('scans_used')
        .eq('user_id', userId)
        .single()

      if (!freshSubErr && freshSub && freshSub.scans_used !== null) {
        actualScans = freshSub.scans_used
      }

    } catch (err) {
      console.warn('[SubscriptionManager] Could not enrich subscription with actual counts:', err)
    }

    console.log('[SubscriptionManager] Final enriched counts - products:', actualProducts, 'invoices:', actualInvoices, 'scans:', actualScans)

    return {
      ...subData,
      products_saved: actualProducts,
      invoices_this_month: actualInvoices,
      scans_used: actualScans,
    }
  }

  const loadSubscriptionData = async (skipAutoSync = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setDataLoaded(true)
        return
      }

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        console.warn('No subscription record found, attempting to create free tier. Error:', error?.message)
        
        // ✅ SAFE: Use INSERT (not upsert) to avoid overwriting existing records
        const now = new Date()
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        
        const { data: newRecord, error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            subscription_type: 'free',
            status: 'active',
            scans_limit: 10,
            products_limit: 20,
            invoices_limit: 10,
            scans_used: 0,
            products_saved: 0,
            invoices_this_month: 0,
            current_period_start: now.toISOString(),
            current_period_end: endOfMonth.toISOString(),
            cancel_at_period_end: false,
          })
          .select()
          .single()

        if (insertError) {
          // If insert fails with duplicate key, the record already exists - try to read it again
          if (insertError.code === '23505') {
            console.log('ℹ️ [SUBSCRIPTION] Record already exists (concurrent insert), re-reading...')
            const { data: existingRecord, error: reReadError } = await supabase
              .from('user_subscriptions')
              .select('*')
              .eq('user_id', user.id)
              .single()

            if (!reReadError && existingRecord) {
              const enriched = await enrichWithActualCounts(existingRecord, user.id)
              setCurrentSubscription(enriched)
              setDataLoaded(true)
              return
            }
          }

          console.error('Failed to create subscription record:', insertError.message)
          const enriched = await enrichWithActualCounts(FREE_TIER_DEFAULTS, user.id)
          setCurrentSubscription(enriched)
        } else if (newRecord) {
          console.log('✅ Created free tier subscription record for user:', user.id)
          const enriched = await enrichWithActualCounts(newRecord, user.id)
          setCurrentSubscription(enriched)
        } else {
          const enriched = await enrichWithActualCounts(FREE_TIER_DEFAULTS, user.id)
          setCurrentSubscription(enriched)
        }
        
        setDataLoaded(true)
        return
      }

      // Count actual records to override the counters from user_subscriptions
      const enriched = await enrichWithActualCounts(data, user.id)

      // ── Auto-correct limits based on subscription_type ──
      // This ensures that if someone manually sets subscription_type in the DB,
      // the correct limits are applied even if the limit columns weren't updated.
      const PLAN_LIMITS: Record<string, { scans: number; products: number; invoices: number }> = {
        free: { scans: 10, products: 20, invoices: 10 },
        basic: { scans: 20, products: 40, invoices: 20 },
        pro: { scans: 50, products: 100, invoices: 50 },
        premium: { scans: -1, products: -1, invoices: -1 },
        paid: { scans: -1, products: -1, invoices: -1 }, // fallback for generic paid
      }

      const expectedLimits = PLAN_LIMITS[enriched.subscription_type]
      if (expectedLimits) {
        const needsUpdate =
          enriched.scans_limit !== expectedLimits.scans ||
          enriched.products_limit !== expectedLimits.products ||
          enriched.invoices_limit !== expectedLimits.invoices

        if (needsUpdate) {
          console.warn(`⚠️ [LIMITS FIX] subscription_type="${enriched.subscription_type}" but limits don't match. Correcting...`)
          enriched.scans_limit = expectedLimits.scans
          enriched.products_limit = expectedLimits.products
          enriched.invoices_limit = expectedLimits.invoices

          // Also update the DB so it's persistent
          try {
            await supabase
              .from('user_subscriptions')
              .update({
                scans_limit: expectedLimits.scans,
                products_limit: expectedLimits.products,
                invoices_limit: expectedLimits.invoices,
              })
              .eq('user_id', user.id)
            console.log('✅ [LIMITS FIX] DB limits corrected for plan:', enriched.subscription_type)
          } catch (fixErr) {
            console.error('❌ [LIMITS FIX] Failed to update DB limits:', fixErr)
          }
        }
      }

      // ── Fix stale current_period_end ──
      // For free plans or manually-set paid plans (no stripe_customer_id),
      // the period should always end at end of current month.
      if (enriched.current_period_end) {
        const now = new Date()
        const periodEnd = new Date(enriched.current_period_end)
        const diffMs = periodEnd.getTime() - now.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        const isFree = enriched.subscription_type === 'free'
        const isManualPaid = enriched.subscription_type !== 'free' && !enriched.stripe_customer_id

        if ((isFree || isManualPaid) && diffDays > 31) {
          console.warn(`⚠️ [SUBSCRIPTION FIX] ${enriched.subscription_type} user (manual=${isManualPaid}) has current_period_end ${diffDays} days away — correcting to end of month`)
          const correctedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

          // Update the DB record so it doesn't happen again
          try {
            await supabase
              .from('user_subscriptions')
              .update({
                current_period_start: now.toISOString(),
                current_period_end: correctedEnd.toISOString(),
              })
              .eq('user_id', user.id)
            console.log('✅ [SUBSCRIPTION FIX] DB record updated to end of month:', correctedEnd.toISOString())
          } catch (fixErr) {
            console.error('❌ [SUBSCRIPTION FIX] Failed to update DB:', fixErr)
          }

          // Also fix the local state so the UI shows the correct countdown
          enriched.current_period_end = correctedEnd.toISOString()
        }
      }

      setCurrentSubscription(enriched)
      setDataLoaded(true)

      // ── Auto-sync logic ──
      if (!skipAutoSync && !autoSyncDone.current) {
        autoSyncDone.current = true

        // Check for session_id in URL (post-checkout redirect)
        const urlParams = new URLSearchParams(window.location.search)
        const sessionId = urlParams.get('session_id')

        if (sessionId) {
          console.log('🔄 [AUTO-SYNC] Detected checkout session_id in URL, syncing after delay...')
          // Clean up the URL
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
          
          // Wait 3 seconds for webhook to process, then sync
          setTimeout(async () => {
            const synced = await syncSubscription(true)
            if (synced) {
              toast({
                title: '🎉 ' + t('subscriptions.planActivated'),
                description: t('subscriptions.planActivatedDesc'),
              })
            } else {
              // Retry once more after another 3 seconds
              setTimeout(async () => {
                const retried = await syncSubscription(true)
                if (retried) {
                  toast({
                    title: '🎉 ' + t('subscriptions.planActivated'),
                    description: t('subscriptions.planActivatedDesc'),
                  })
                }
              }, 3000)
            }
          }, 3000)
        } else if (enriched.subscription_type === 'free' && enriched.stripe_customer_id) {
          // Auto-sync: user is on free plan but has a Stripe customer ID
          console.log('🔄 [AUTO-SYNC] Free plan with stripe_customer_id, auto-syncing...')
          syncSubscription(true)
        }
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
      setCurrentSubscription(FREE_TIER_DEFAULTS)
      setDataLoaded(true)
      toast({
        title: t('subscriptions.errorLoading'),
        variant: 'destructive'
      })
    }
  }

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  // Calculate days until renewal and update countdown
  useEffect(() => {
    const periodEnd = currentSubscription?.current_period_end
    if (periodEnd) {
      const calculateDays = () => {
        const renewalDate = new Date(periodEnd)
        const now = new Date()
        const diffTime = renewalDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        setDaysUntilRenewal(diffDays > 0 ? diffDays : 0)
      }

      calculateDays()
      const interval = setInterval(calculateDays, 1000 * 60 * 60)
      
      return () => clearInterval(interval)
    } else {
      // For free tier without period_end, calculate days until end of month
      const now = new Date()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const diffDays = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      setDaysUntilRenewal(diffDays > 0 ? diffDays : 0)
    }
  }, [currentSubscription?.current_period_end])

  const handleSubscribe = async (priceId: string, planType: string) => {
    if (!priceId) {
      toast({
        title: t('subscriptions.currentPlan'),
        description: t('subscriptions.alreadyOnFreePlan'),
      })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: t('subscriptions.loginRequired'),
          variant: 'destructive'
        })
        return
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { 
          priceId,
          planType: planType.toUpperCase()
        }
      })

      if (error) throw error

      if (data?.url) {
        window.location.href = data.url
      }
    } catch (error: unknown) {
      console.error('Error creating checkout session:', error)
      toast({
        title: t('subscriptions.errorCheckout'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: t('subscriptions.loginRequired'),
          variant: 'destructive'
        })
        return
      }

      const { data, error } = await supabase.functions.invoke('create-portal-session')

      if (error) throw error

      if (data?.url) {
        // Use window.location.href as fallback for mobile browsers
        // where window.open('_blank') is blocked by popup blockers
        const newWindow = window.open(data.url, '_blank')
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          window.location.href = data.url
        }
      }
    } catch (error: unknown) {
      console.error('Error opening customer portal:', error)
      toast({
        title: t('subscriptions.errorPortal'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      })
    } finally {
      setPortalLoading(false)
    }
  }

  const formatLimit = (limit: number) => {
    return limit === -1 ? t('subscriptions.unlimited') : limit.toString()
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0
    if (limit === 0) return 100
    return Math.min((used / limit) * 100, 100)
  }

  const getUsageColor = (used: number, limit: number) => {
    if (limit === -1) return 'bg-green-500'
    const pct = (used / limit) * 100
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 70) return 'bg-orange-500'
    if (pct >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getRemaining = (used: number, limit: number) => {
    if (limit === -1) return '∞'
    return Math.max(limit - used, 0).toString()
  }

  const isLimitReached = (used: number, limit: number) => {
    if (limit === -1) return false
    return used >= limit
  }

  const getPlanDisplayName = (type: string) => {
    switch (type) {
      case 'free': return t('subscriptions.planFree')
      case 'basic': return t('subscriptions.planBasic')
      case 'pro': return t('subscriptions.planPro')
      case 'premium': return t('subscriptions.planPremium')
      default: return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  const getRenewalDateDisplay = () => {
    if (currentSubscription?.current_period_end) {
      return new Date(currentSubscription.current_period_end).toLocaleDateString(dateLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }
    // Fallback: end of current month
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return endOfMonth.toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // The subscription data to display (always available after loading)
  const sub = currentSubscription || FREE_TIER_DEFAULTS

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CURRENT SUBSCRIPTION STATUS - ALWAYS VISIBLE                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {dataLoaded && (
        <Card className="border-2 border-primary shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {sub.subscription_type === 'premium' ? <Crown className="h-6 w-6 text-yellow-500" /> :
                   sub.subscription_type === 'pro' ? <Zap className="h-6 w-6 text-blue-500" /> :
                   sub.subscription_type === 'basic' ? <Zap className="h-6 w-6 text-green-500" /> :
                   <Shield className="h-6 w-6 text-slate-500" />}
                  {t('subscriptions.currentPlan')}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {getPlanDisplayName(sub.subscription_type)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* ✅ Sync Subscription Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => syncSubscription(false)}
                  disabled={syncing}
                  title={t('subscriptions.syncSubscription')}
                  className="h-9 w-9"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                </Button>
                <Badge 
                  variant={sub.status === 'active' ? 'default' : 'secondary'} 
                  className={`text-sm px-4 py-1.5 ${
                    sub.status === 'active' 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {sub.status === 'active' ? `✅ ${t('subscriptions.statusActive')}` : t('subscriptions.statusInactive')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ── Syncing indicator ── */}
            {syncing && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                  {t('subscriptions.syncingWithStripe')}
                </p>
              </div>
            )}

            {/* ── Usage Meters ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Scans */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">
                    {t('subscriptions.scans')} 
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({sub.subscription_type === 'free' ? t('subscriptions.totalLabel') : t('subscriptions.monthlyLabel')})
                    </span>
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isLimitReached(sub.scans_used, sub.scans_limit)
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {sub.scans_used} / {formatLimit(sub.scans_limit)}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${getUsageColor(sub.scans_used, sub.scans_limit)}`}
                    style={{ width: `${getUsagePercentage(sub.scans_used, sub.scans_limit)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('subscriptions.remaining')}: <span className="font-bold text-foreground">{getRemaining(sub.scans_used, sub.scans_limit)}</span>
                </p>
                {isLimitReached(sub.scans_used, sub.scans_limit) && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{t('subscriptions.limitReached')}</span>
                  </div>
                )}
              </div>

              {/* Products */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">{t('subscriptions.products')}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isLimitReached(sub.products_saved, sub.products_limit)
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {sub.products_saved} / {formatLimit(sub.products_limit)}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${getUsageColor(sub.products_saved, sub.products_limit)}`}
                    style={{ width: `${getUsagePercentage(sub.products_saved, sub.products_limit)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('subscriptions.remaining')}: <span className="font-bold text-foreground">{getRemaining(sub.products_saved, sub.products_limit)}</span>
                </p>
                {isLimitReached(sub.products_saved, sub.products_limit) && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{t('subscriptions.limitReached')}</span>
                  </div>
                )}
              </div>

              {/* Invoices */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">{t('subscriptions.invoices')}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isLimitReached(sub.invoices_this_month, sub.invoices_limit)
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {sub.invoices_this_month} / {formatLimit(sub.invoices_limit)}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${getUsageColor(sub.invoices_this_month, sub.invoices_limit)}`}
                    style={{ width: `${getUsagePercentage(sub.invoices_this_month, sub.invoices_limit)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('subscriptions.remaining')}: <span className="font-bold text-foreground">{getRemaining(sub.invoices_this_month, sub.invoices_limit)}</span>
                </p>
                {isLimitReached(sub.invoices_this_month, sub.invoices_limit) && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{t('subscriptions.limitReached')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Countdown Timer ── */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {sub.cancel_at_period_end
                        ? t('subscriptions.expiresIn')
                        : t('subscriptions.countersResetIn')}
                    </span>
                    <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {daysUntilRenewal} {t('subscriptions.days')}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    {sub.cancel_at_period_end
                      ? `${t('subscriptions.expirationDate')}: ${getRenewalDateDisplay()}`
                      : `${t('subscriptions.renewalDate')}: ${getRenewalDateDisplay()}`}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Cancellation Warning ── */}
            {sub.cancel_at_period_end && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                  ⚠️ {t('subscriptions.cancelAtPeriodEnd')}
                </p>
              </div>
            )}

            {/* ── Manage Subscription Button (only for paid plans with Stripe) ── */}
            {sub.stripe_customer_id && (
              <div className="flex justify-end pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                >
                  {portalLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  {t('subscriptions.manageSubscription')}
                </Button>
              </div>
            )}

            {/* ── Upgrade prompt for free users ── */}
            {sub.subscription_type === 'free' && (
              <div className="text-center pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  {t('subscriptions.upgradePrompt')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* AVAILABLE PLANS                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-2xl font-bold mb-6">{t('subscriptions.availablePlans')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = sub.subscription_type === plan.type
            return (
              <Card 
                key={plan.name} 
                className={`relative transition-all ${
                  isCurrentPlan 
                    ? 'border-2 border-primary shadow-lg ring-2 ring-primary/20' 
                    : plan.popular 
                      ? 'border-primary shadow-lg' 
                      : 'hover:shadow-md'
                }`}
              >
                {/* Current plan badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-md px-3">
                      {t('subscriptions.currentPlan')}
                    </Badge>
                  </div>
                )}
                {/* Popular badge */}
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge variant="default" className="shadow-md px-3">
                      {t('subscriptions.popular')}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pt-6">
                  <div className="flex items-center gap-2">
                    {plan.icon}
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    {plan.price === '0' ? (
                      <span className="text-3xl font-bold">{t('subscriptions.free')}</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">{currencySymbol}{plan.price}</span>
                        <span className="text-muted-foreground">/{t('subscriptions.month')}</span>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? 'secondary' : plan.popular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(plan.priceId, plan.name)}
                    disabled={loading || isCurrentPlan || plan.type === 'free'}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isCurrentPlan
                      ? t('subscriptions.currentPlan')
                      : plan.type === 'free'
                        ? t('subscriptions.free')
                        : t('subscriptions.subscribe')
                    }
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}