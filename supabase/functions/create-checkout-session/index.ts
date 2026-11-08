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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('No user found')
    }

    const { priceId } = await req.json()

    if (!priceId) {
      throw new Error('Price ID is required')
    }

    // SECURITY: the plan is derived server-side from an allow-list of price IDs.
    // The client-provided planType is ignored so nobody can pay Basic and get Premium.
    const ALLOWED_PRICES: Record<string, string> = {
      'price_1TnOCyERHOOWoH8ZQONG0cH3': 'basic',   // €4.99/mese
      'price_1TnOCYERHOOWoH8ZtjpcvBgZ': 'pro',     // €9.99/mese
      'price_1TnOAxERHOOWoH8ZsINJgJUN': 'premium', // €14.99/mese
    }
    const planType = ALLOWED_PRICES[priceId]
    if (!planType) {
      throw new Error('Invalid price ID')
    }

    // Get or create Stripe customer
    const { data: subscription } = await supabaseClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId = subscription?.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Update subscription with customer ID
      await supabaseClient
        .from('user_subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/dashboard`,
      metadata: {
        user_id: user.id,
        plan_type: planType,
      },
      // Persist the plan on the subscription too, so customer.subscription.updated
      // events (renewals, portal changes) can resolve the plan reliably.
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: planType,
        },
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})