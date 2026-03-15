import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search for customer by metadata (user_id)
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions'],
    });

    // Find customer with matching user_id in metadata
    const customer = customers.data.find(
      (c) => c.metadata?.user_id === userId
    );

    if (!customer) {
      // No customer found, return trial status
      return new Response(
        JSON.stringify({
          isActive: false,
          status: 'trialing',
          currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionType: 'trial',
          daysRemaining: 7,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer's subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No subscription found, return trial status
      return new Response(
        JSON.stringify({
          isActive: false,
          status: 'trialing',
          currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionType: 'trial',
          daysRemaining: 7,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscription = subscriptions.data[0];
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const daysRemaining = Math.ceil(
      (subscription.current_period_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return new Response(
      JSON.stringify({
        isActive,
        status: subscription.status,
        currentPeriodEnd,
        subscriptionType: subscription.status === 'active' ? 'paid' : 'trial',
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});