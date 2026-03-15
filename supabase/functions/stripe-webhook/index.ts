import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

// ✅ Centralized plan limits configuration
// Free: 20 products, 10 invoices, 10 scans (total)
// Basic (€9.99/mo): 40 products, 20 invoices, 20 scans/month
// Pro (€19.99/mo): 100 products, 50 invoices, 50 scans/month
// Premium (€49.99/mo): unlimited
function getPlanLimits(planType: string): { products_limit: number; invoices_limit: number; scans_limit: number } {
  const plan = (planType || 'free').toLowerCase()
  switch (plan) {
    case 'premium':
      return { products_limit: -1, invoices_limit: -1, scans_limit: -1 } // unlimited
    case 'pro':
      return { products_limit: 100, invoices_limit: 50, scans_limit: 50 }
    case 'basic':
      return { products_limit: 40, invoices_limit: 20, scans_limit: 20 }
    case 'free':
    default:
      return { products_limit: 20, invoices_limit: 10, scans_limit: 10 }
  }
}

// ✅ Determine plan type from Stripe price ID
function getPlanTypeFromPrice(priceId: string): string {
  // Map known price IDs to plan types
  // These should match your Stripe dashboard price IDs
  const priceToPlan: Record<string, string> = {
    // Add your actual Stripe price IDs here
    // e.g. 'price_xxx': 'basic',
  }
  return priceToPlan[priceId] || 'basic'
}

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Processing webhook event: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const planType = session.metadata?.plan_type

        if (!userId) {
          throw new Error('No user_id in session metadata')
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        )

        const resolvedPlan = (planType || 'basic').toLowerCase()
        const limits = getPlanLimits(resolvedPlan)

        console.log(`✅ checkout.session.completed: user=${userId}, plan=${resolvedPlan}, limits=`, limits)

        // Update user subscription in database
        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0].price.id,
            subscription_type: resolvedPlan,
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            // ✅ Set correct limits based on plan
            scans_limit: limits.scans_limit,
            products_limit: limits.products_limit,
            invoices_limit: limits.invoices_limit,
          })
          .eq('user_id', userId)

        if (error) throw error
        console.log(`Subscription activated for user ${userId} with plan ${resolvedPlan}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by customer ID
        const { data: userSub, error: findError } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, subscription_type')
          .eq('stripe_customer_id', customerId)
          .single()

        if (findError || !userSub) {
          console.error('User not found for customer:', customerId)
          break
        }

        // ✅ Determine the new plan type from subscription metadata or price
        const priceId = subscription.items.data[0]?.price?.id || ''
        const productId = subscription.items.data[0]?.price?.product as string || ''
        
        // Try to get plan from subscription metadata first
        let newPlanType = subscription.metadata?.plan_type?.toLowerCase() || ''
        
        // If no metadata, try to determine from price
        if (!newPlanType && priceId) {
          newPlanType = getPlanTypeFromPrice(priceId)
        }

        // If we still don't have a plan type, try to get it from the product name
        if (!newPlanType && productId) {
          try {
            const product = await stripe.products.retrieve(productId)
            const productName = (product.name || '').toLowerCase()
            if (productName.includes('premium')) newPlanType = 'premium'
            else if (productName.includes('pro')) newPlanType = 'pro'
            else if (productName.includes('basic')) newPlanType = 'basic'
            else newPlanType = 'basic'
            console.log(`Resolved plan from product name "${product.name}": ${newPlanType}`)
          } catch (e) {
            console.error('Failed to retrieve product:', e)
            newPlanType = userSub.subscription_type || 'basic'
          }
        }

        // Fall back to current plan if we couldn't determine
        if (!newPlanType) {
          newPlanType = userSub.subscription_type || 'basic'
        }

        const limits = getPlanLimits(newPlanType)

        console.log(`✅ subscription.updated: user=${userSub.user_id}, oldPlan=${userSub.subscription_type}, newPlan=${newPlanType}, limits=`, limits)

        // ✅ Update subscription status AND limits
        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            subscription_type: newPlanType,
            status: subscription.status === 'active' ? 'active' : 
                   subscription.status === 'canceled' ? 'canceled' :
                   subscription.status === 'past_due' ? 'past_due' : 'inactive',
            stripe_price_id: priceId,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            // ✅ IMPORTANT: Update limits when plan changes
            scans_limit: limits.scans_limit,
            products_limit: limits.products_limit,
            invoices_limit: limits.invoices_limit,
          })
          .eq('user_id', userSub.user_id)

        if (error) throw error
        console.log(`Subscription updated for user ${userSub.user_id} to plan ${newPlanType}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by customer ID
        const { data: userSub, error: findError } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (findError || !userSub) {
          console.error('User not found for customer:', customerId)
          break
        }

        const freeLimits = getPlanLimits('free')

        // Downgrade to free plan
        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            subscription_type: 'free',
            status: 'active',
            stripe_subscription_id: null,
            stripe_price_id: null,
            cancel_at_period_end: false,
            canceled_at: new Date().toISOString(),
            // ✅ Reset to free plan limits
            scans_limit: freeLimits.scans_limit,
            products_limit: freeLimits.products_limit,
            invoices_limit: freeLimits.invoices_limit,
          })
          .eq('user_id', userSub.user_id)

        if (error) throw error
        console.log(`Subscription canceled for user ${userSub.user_id}, downgraded to free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find user by customer ID
        const { data: userSub, error: findError } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (findError || !userSub) {
          console.error('User not found for customer:', customerId)
          break
        }

        // Mark subscription as past_due
        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: 'past_due',
          })
          .eq('user_id', userSub.user_id)

        if (error) throw error
        console.log(`Payment failed for user ${userSub.user_id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})