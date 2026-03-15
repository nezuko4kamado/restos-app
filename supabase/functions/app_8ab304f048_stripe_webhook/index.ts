import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const APP_ID = '8ab304f048';

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Webhook request received`, {
    method: req.method,
    url: req.url,
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error(`[${requestId}] Missing stripe-signature header`);
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    console.log(`[${requestId}] Body size: ${body.length} bytes`);

    // Verify webhook signature
    const webhookSecret = Deno.env.get('APP_8ab304f048_STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error(`[${requestId}] Webhook secret not configured`);
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    ) as StripeEvent;

    console.log(`[${requestId}] Event verified:`, {
      type: event.type,
      id: event.id,
    });

    // Validate app_id from metadata if present
    const metadata = event.data.object.metadata;
    if (metadata?.app_id && metadata.app_id !== APP_ID) {
      console.log(`[${requestId}] Event for different app (${metadata.app_id}), skipping`);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(requestId, event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(requestId, event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(requestId, event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(requestId, event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(requestId, event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(requestId, event.data.object);
        break;
      
      default:
        console.log(`[${requestId}] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(`[${requestId}] Webhook error:`, {
      message: err.message,
      stack: err.stack,
    });
    
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});

async function handleCheckoutCompleted(requestId: string, session: any) {
  console.log(`[${requestId}] Processing checkout.session.completed`, {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
  });

  try {
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    const customerEmail = session.customer_details?.email;

    if (!customerId || !subscriptionId) {
      console.error(`[${requestId}] Missing customer or subscription ID`);
      return;
    }

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log(`[${requestId}] Retrieved subscription:`, {
      id: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    });

    // Find user by email or customer_id
    let userId: string | null = null;

    if (customerEmail) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData.users.find(u => u.email === customerEmail);
      if (user) {
        userId = user.id;
        console.log(`[${requestId}] Found user by email: ${userId}`);
      }
    }

    if (!userId) {
      // Try to find by existing customer_id
      const { data: existingSub } = await supabase
        .from('app_8ab304f048_user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();
      
      if (existingSub) {
        userId = existingSub.user_id;
        console.log(`[${requestId}] Found user by customer_id: ${userId}`);
      }
    }

    if (!userId) {
      console.error(`[${requestId}] Could not find user for customer ${customerId}`);
      return;
    }

    // Update or insert subscription
    const { error } = await supabase
      .from('app_8ab304f048_user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_type: 'paid',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error(`[${requestId}] Error updating subscription:`, error);
    } else {
      console.log(`[${requestId}] Successfully updated subscription for user ${userId}`);
    }
  } catch (err) {
    console.error(`[${requestId}] Error in handleCheckoutCompleted:`, err);
  }
}

async function handleSubscriptionCreated(requestId: string, subscription: any) {
  console.log(`[${requestId}] Processing customer.subscription.created`, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  });

  try {
    const customerId = subscription.customer;
    
    // Find user by customer_id
    const { data: existingSub } = await supabase
      .from('app_8ab304f048_user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!existingSub) {
      console.log(`[${requestId}] No existing subscription found for customer ${customerId}`);
      return;
    }

    const { error } = await supabase
      .from('app_8ab304f048_user_subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_type: 'paid',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', existingSub.user_id);

    if (error) {
      console.error(`[${requestId}] Error updating subscription:`, error);
    } else {
      console.log(`[${requestId}] Successfully created subscription for user ${existingSub.user_id}`);
    }
  } catch (err) {
    console.error(`[${requestId}] Error in handleSubscriptionCreated:`, err);
  }
}

async function handleSubscriptionUpdated(requestId: string, subscription: any) {
  console.log(`[${requestId}] Processing customer.subscription.updated`, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  });

  try {
    const { error } = await supabase
      .from('app_8ab304f048_user_subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error(`[${requestId}] Error updating subscription:`, error);
    } else {
      console.log(`[${requestId}] Successfully updated subscription ${subscription.id}`);
    }
  } catch (err) {
    console.error(`[${requestId}] Error in handleSubscriptionUpdated:`, err);
  }
}

async function handleSubscriptionDeleted(requestId: string, subscription: any) {
  console.log(`[${requestId}] Processing customer.subscription.deleted`, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });

  try {
    const { error } = await supabase
      .from('app_8ab304f048_user_subscriptions')
      .update({
        status: 'canceled',
        subscription_end_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error(`[${requestId}] Error canceling subscription:`, error);
    } else {
      console.log(`[${requestId}] Successfully canceled subscription ${subscription.id}`);
    }
  } catch (err) {
    console.error(`[${requestId}] Error in handleSubscriptionDeleted:`, err);
  }
}

async function handlePaymentSucceeded(requestId: string, invoice: any) {
  console.log(`[${requestId}] Processing invoice.payment_succeeded`, {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
  });

  try {
    if (!invoice.subscription) {
      console.log(`[${requestId}] Invoice not related to subscription, skipping`);
      return;
    }

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

    const { error } = await supabase
      .from('app_8ab304f048_user_subscriptions')
      .update({
        status: 'active',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', invoice.subscription);

    if (error) {
      console.error(`[${requestId}] Error updating subscription after payment:`, error);
    } else {
      console.log(`[${requestId}] Successfully updated subscription after payment`);
    }
  } catch (err) {
    console.error(`[${requestId}] Error in handlePaymentSucceeded:`, err);
  }
}

async function handlePaymentFailed(requestId: string, invoice: any) {
  console.log(`[${requestId}] Processing invoice.payment_failed`, {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
  });

  try {
    if (!invoice.subscription) {
      console.log(`[${requestId}] Invoice not related to subscription, skipping`);
      return;
    }

    const { error } = await supabase
      .from('app_8ab304f048_user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', invoice.subscription);

    if (error) {
      console.error(`[${requestId}] Error updating subscription after failed payment:`, error);
    } else {
      console.log(`[${requestId}] Successfully marked subscription as past_due`);
    }
  } catch (err) {
    console.error(`[${requestId}] Error in handlePaymentFailed:`, err);
  }
}