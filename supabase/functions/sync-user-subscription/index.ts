import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Known price IDs mapped to plan types
const PRICE_TO_PLAN: Record<string, string> = {
  'price_1Sro9hERHOOWoH8ZAusBoEDS': 'basic',
  'price_1SroFeERHOOWoH8ZzKxaihdT': 'pro',
  'price_1SroIRERHOOWoH8Zyi6tTBGy': 'premium',
}

// Centralized plan limits (must match stripe-webhook)
function getPlanLimits(planType: string): { products_limit: number; invoices_limit: number; scans_limit: number } {
  const plan = (planType || 'free').toLowerCase()
  switch (plan) {
    case 'premium':
      return { products_limit: -1, invoices_limit: -1, scans_limit: -1 }
    case 'pro':
      return { products_limit: 100, invoices_limit: 50, scans_limit: 50 }
    case 'basic':
      return { products_limit: 40, invoices_limit: 20, scans_limit: 20 }
    case 'free':
    default:
      return { products_limit: 20, invoices_limit: 10, scans_limit: 10 }
  }
}

// Determine plan type from a Stripe subscription
async function determinePlanType(subscription: Stripe.Subscription): Promise<string> {
  const priceId = subscription.items.data[0]?.price?.id || ''
  const productId = subscription.items.data[0]?.price?.product as string || ''

  // 1. Check known price IDs
  if (priceId && PRICE_TO_PLAN[priceId]) {
    console.log(`✅ Plan resolved from price ID ${priceId}: ${PRICE_TO_PLAN[priceId]}`)
    return PRICE_TO_PLAN[priceId]
  }

  // 2. Check subscription metadata
  const metaPlan = subscription.metadata?.plan_type?.toLowerCase()
  if (metaPlan && ['basic', 'pro', 'premium'].includes(metaPlan)) {
    console.log(`✅ Plan resolved from subscription metadata: ${metaPlan}`)
    return metaPlan
  }

  // 3. Check product name
  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId)
      const productName = (product.name || '').toLowerCase()
      if (productName.includes('premium')) return 'premium'
      if (productName.includes('pro')) return 'pro'
      if (productName.includes('basic')) return 'basic'
      console.log(`✅ Plan resolved from product name "${product.name}": basic (default)`)
    } catch (e) {
      console.error('Failed to retrieve product:', e)
    }
  }

  // 4. Check price amount as last resort
  try {
    if (priceId) {
      const price = await stripe.prices.retrieve(priceId)
      const amount = (price.unit_amount || 0) / 100
      if (amount >= 40) return 'premium'
      if (amount >= 15) return 'pro'
      if (amount >= 5) return 'basic'
    }
  } catch (e) {
    console.error('Failed to retrieve price:', e)
  }

  return 'basic' // default fallback for paid subscriptions
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate the user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    console.log(`🔄 [SYNC] Starting subscription sync for user: ${user.id} (${user.email})`)

    // Get current subscription record
    const { data: currentSub, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError || !currentSub) {
      console.log('No subscription record found, creating one...')
      // Create a default free record
      const now = new Date()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      const freeLimits = getPlanLimits('free')

      await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          subscription_type: 'free',
          status: 'active',
          ...freeLimits,
          scans_used: 0,
          products_saved: 0,
          invoices_this_month: 0,
          current_period_start: now.toISOString(),
          current_period_end: endOfMonth.toISOString(),
          cancel_at_period_end: false,
        }, { onConflict: 'user_id' })
    }

    let stripeCustomerId = currentSub?.stripe_customer_id

    // If no stripe_customer_id, try to find customer by email
    if (!stripeCustomerId && user.email) {
      console.log(`🔍 [SYNC] No stripe_customer_id found, searching Stripe by email: ${user.email}`)
      try {
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        })
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id
          console.log(`✅ [SYNC] Found Stripe customer by email: ${stripeCustomerId}`)

          // Save the customer ID
          await supabaseAdmin
            .from('user_subscriptions')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('user_id', user.id)
        } else {
          console.log('❌ [SYNC] No Stripe customer found for this email')
        }
      } catch (e) {
        console.error('Error searching Stripe customers:', e)
      }
    }

    // If we still don't have a customer ID, nothing to sync
    if (!stripeCustomerId) {
      console.log('ℹ️ [SYNC] No Stripe customer found. Keeping free plan.')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No Stripe customer found. Subscription remains on free plan.',
          plan: 'free',
          synced: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fetch active subscriptions from Stripe
    console.log(`🔍 [SYNC] Fetching subscriptions for Stripe customer: ${stripeCustomerId}`)
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 10,
    })

    // Also check for trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'trialing',
      limit: 10,
    })

    const allActiveSubscriptions = [
      ...subscriptions.data,
      ...trialingSubscriptions.data,
    ]

    console.log(`📋 [SYNC] Found ${allActiveSubscriptions.length} active/trialing subscriptions`)

    if (allActiveSubscriptions.length === 0) {
      // Check for past_due subscriptions too
      const pastDueSubscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'past_due',
        limit: 5,
      })

      if (pastDueSubscriptions.data.length > 0) {
        const sub = pastDueSubscriptions.data[0]
        const planType = await determinePlanType(sub)
        const limits = getPlanLimits(planType)

        console.log(`⚠️ [SYNC] Found past_due subscription, plan: ${planType}`)

        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            stripe_subscription_id: sub.id,
            stripe_price_id: sub.items.data[0]?.price?.id || null,
            subscription_type: planType,
            status: 'past_due',
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            ...limits,
          })
          .eq('user_id', user.id)

        return new Response(
          JSON.stringify({
            success: true,
            message: `Subscription synced as ${planType} (past_due)`,
            plan: planType,
            status: 'past_due',
            synced: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // No active subscriptions at all - keep as free
      console.log('ℹ️ [SYNC] No active subscriptions found in Stripe. Keeping current plan.')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active Stripe subscription found.',
          plan: currentSub?.subscription_type || 'free',
          synced: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Use the most recent active subscription
    const activeSub = allActiveSubscriptions[0]
    const planType = await determinePlanType(activeSub)
    const limits = getPlanLimits(planType)

    console.log(`✅ [SYNC] Syncing subscription: plan=${planType}, status=${activeSub.status}, limits=`, limits)

    // Update the database
    const { error: updateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: activeSub.id,
        stripe_price_id: activeSub.items.data[0]?.price?.id || null,
        subscription_type: planType,
        status: activeSub.status === 'active' || activeSub.status === 'trialing' ? 'active' : activeSub.status,
        current_period_start: new Date(activeSub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(activeSub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: activeSub.cancel_at_period_end,
        ...limits,
      })
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`)
    }

    console.log(`✅ [SYNC] Subscription synced successfully: ${planType} (${activeSub.status})`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Subscription synced to ${planType} plan`,
        plan: planType,
        status: activeSub.status,
        synced: true,
        limits,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('❌ [SYNC] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})