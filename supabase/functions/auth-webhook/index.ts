import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
// EMAIL NOTIFICATIONS DISABLED - Uncomment the lines below to re-enable
// import {
//   sendNotificationEmail,
//   formatUserRegistrationEmail,
// } from '../_shared/email.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AuthWebhookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    email: string;
    created_at: string;
  };
  schema: string;
  old_record: null | Record<string, unknown>;
}

Deno.serve(async (req) => {
  try {
    const payload: AuthWebhookPayload = await req.json();

    console.log('Received auth webhook:', payload.type);

    // Only process INSERT events on auth.users table
    if (payload.type === 'INSERT' && payload.table === 'users') {
      const { id: userId, email } = payload.record;

      console.log('New user registered:', email);

      // ✅ AUTO-CREATE user_subscriptions record with free tier defaults
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Calculate end of current month for current_period_end
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const { error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
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
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_price_id: null,
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: true,
        });

      if (subError) {
        console.error('Error creating user_subscriptions record:', subError);
      } else {
        console.log('✅ user_subscriptions record created for user:', userId, '(free tier)');
      }

      // EMAIL NOTIFICATION DISABLED
      // Uncomment the lines below to re-enable email notifications
      // await sendNotificationEmail({
      //   subject: '🎉 Nuova Registrazione Utente',
      //   html: formatUserRegistrationEmail(email, userId),
      // });

      console.log('Registration notification disabled for:', email);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Auth webhook error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 400 }
    );
  }
});