import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
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
    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Starting Stripe sync...');

    // Get all subscriptions from database
    const { data: dbSubscriptions, error: dbError } = await supabaseClient
      .from('user_subscriptions')
      .select('user_id, stripe_customer_id, stripe_subscription_id, status')
      .not('stripe_subscription_id', 'is', null);

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log(`Found ${dbSubscriptions?.length || 0} subscriptions to sync`);

    const syncResults = {
      total: dbSubscriptions?.length || 0,
      updated: 0,
      errors: 0,
      details: [] as any[]
    };

    // Sync each subscription with Stripe
    for (const dbSub of dbSubscriptions || []) {
      try {
        if (!dbSub.stripe_subscription_id) continue;

        // Fetch subscription from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(
          dbSub.stripe_subscription_id
        );

        console.log(`Syncing subscription ${stripeSubscription.id}: ${stripeSubscription.status}`);

        // Update database with Stripe data
        const { error: updateError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            status: stripeSubscription.status,
            subscription_type: stripeSubscription.status === 'active' ? 'paid' : 'trial',
            current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', dbSub.user_id);

        if (updateError) {
          console.error(`Error updating subscription ${dbSub.stripe_subscription_id}:`, updateError);
          syncResults.errors++;
          syncResults.details.push({
            subscription_id: dbSub.stripe_subscription_id,
            error: updateError.message
          });
        } else {
          syncResults.updated++;
          syncResults.details.push({
            subscription_id: dbSub.stripe_subscription_id,
            status: stripeSubscription.status,
            synced: true
          });
        }
      } catch (error) {
        console.error(`Error syncing subscription ${dbSub.stripe_subscription_id}:`, error);
        syncResults.errors++;
        syncResults.details.push({
          subscription_id: dbSub.stripe_subscription_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('Sync completed:', syncResults);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncResults.updated} subscriptions successfully`,
        results: syncResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});