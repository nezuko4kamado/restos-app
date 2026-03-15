# Email Notifications Setup Guide

This guide explains how to set up email notifications for subscription and user registration events.

## Overview

The system sends automatic email notifications to `info@amalfi-alzira.es` for the following events:
1. **New user registration** - When a user signs up
2. **New subscription created** - When a user completes payment
3. **Subscription canceled** - When a subscription is canceled
4. **Payment failed** - When a payment attempt fails

## Email Service: Resend.com

We use [Resend.com](https://resend.com) for sending transactional emails. Resend offers:
- ✅ Free tier: 3,000 emails/month, 100 emails/day
- ✅ Simple API integration
- ✅ Excellent deliverability
- ✅ Works seamlessly with Supabase Edge Functions

## Setup Steps

### 1. Create Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address
3. Navigate to **API Keys** in the dashboard
4. Click **Create API Key**
5. Give it a name (e.g., "Restaurant App Notifications")
6. Copy the API key (starts with `re_`)

### 2. Add Resend API Key to Supabase

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Scroll to **Environment Variables**
4. Click **Add new variable**
5. Add:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (e.g., `re_xxxxxxxxxxxxx`)
6. Click **Save**

#### Option B: Using Supabase CLI

```bash
# Set the environment variable
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 3. Deploy Edge Functions

Deploy the updated webhook functions to Supabase:

```bash
# Deploy Stripe webhook (handles subscription events)
supabase functions deploy stripe-webhook

# Deploy Auth webhook (handles user registration)
supabase functions deploy auth-webhook
```

### 4. Configure Auth Webhook in Supabase

To receive notifications when users register:

1. Go to **Database** → **Webhooks** in Supabase dashboard
2. Click **Create a new hook**
3. Configure:
   - **Name**: User Registration Notifications
   - **Table**: `auth.users`
   - **Events**: Check `INSERT`
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/auth-webhook`
   - **HTTP Headers**:
     ```
     Content-Type: application/json
     Authorization: Bearer [YOUR_SUPABASE_ANON_KEY]
     ```
4. Click **Create webhook**

### 5. Verify Stripe Webhook Configuration

The Stripe webhook should already be configured (see `STRIPE_SETUP_GUIDE.md`), but verify:

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Ensure your webhook endpoint is: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/stripe-webhook`
3. Verify these events are selected:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

## Email Templates

All emails are sent in Italian and include:

### 1. User Registration Email
- **Subject**: 🎉 Nuova Registrazione Utente
- **Content**: User email, User ID, timestamp

### 2. Subscription Created Email
- **Subject**: ✅ Nuovo Abbonamento Creato
- **Content**: User email, Subscription ID, plan details, status

### 3. Subscription Canceled Email
- **Subject**: ❌ Abbonamento Cancellato
- **Content**: User email, Subscription ID, cancellation date

### 4. Payment Failed Email
- **Subject**: ⚠️ Pagamento Fallito
- **Content**: User email, Subscription ID, amount, error message

## Testing

### Test User Registration Email

1. Create a new user account in your app
2. Check `info@amalfi-alzira.es` inbox
3. You should receive a registration notification

### Test Subscription Emails

1. Complete a test subscription using Stripe test mode
2. Use test card: `4242 4242 4242 4242`
3. Check inbox for subscription created email

### Test Payment Failed Email

1. Use a test card that triggers payment failure: `4000 0000 0000 0341`
2. Try to create a subscription
3. Check inbox for payment failed notification

### Test Subscription Canceled Email

1. Go to Stripe Dashboard (test mode)
2. Find a test subscription
3. Click **Cancel subscription**
4. Check inbox for cancellation notification

## Monitoring

### View Email Logs in Resend

1. Go to Resend dashboard
2. Navigate to **Logs**
3. See all sent emails, delivery status, and any errors

### View Function Logs in Supabase

1. Go to **Edge Functions** in Supabase dashboard
2. Select `stripe-webhook` or `auth-webhook`
3. Click **Logs** tab
4. View execution logs and any errors

## Troubleshooting

### Emails Not Being Sent

1. **Check Resend API Key**: Verify it's correctly set in Supabase environment variables
2. **Check Function Logs**: Look for errors in Edge Function logs
3. **Verify Webhook Configuration**: Ensure webhooks are properly configured
4. **Check Resend Logs**: See if emails are being rejected or bouncing

### Emails Going to Spam

1. In Resend dashboard, verify your domain (optional but recommended)
2. Add SPF and DKIM records to your domain DNS
3. Use a custom sending domain instead of `notifications@resend.dev`

### Webhook Not Triggering

1. **Stripe Webhook**: Check Stripe webhook logs for delivery failures
2. **Auth Webhook**: Verify the database webhook is enabled in Supabase
3. **Function Deployment**: Ensure functions are deployed successfully

## Environment Variables Summary

Required environment variables in Supabase:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx          # From Resend.com
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx  # From Stripe
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx # From Stripe webhook
SUPABASE_URL=https://xxxxx.supabase.co   # Your Supabase URL
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx  # From Supabase settings
```

## Cost Considerations

- **Resend Free Tier**: 3,000 emails/month, 100 emails/day
- For most small to medium applications, this is sufficient
- If you exceed limits, Resend offers affordable paid plans starting at $20/month for 50,000 emails

## Security Notes

- ✅ All emails are sent server-side via Edge Functions
- ✅ API keys are stored securely in Supabase environment variables
- ✅ Webhooks are verified using signatures (Stripe) or authorization headers (Supabase)
- ✅ No sensitive user data is exposed in emails (only email addresses and IDs)

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Check Resend email logs
3. Verify all environment variables are set correctly
4. Ensure webhooks are properly configured