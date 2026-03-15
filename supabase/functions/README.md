# Supabase Edge Functions

This directory contains Supabase Edge Functions for the Restaurant App.

## Functions Overview

### 1. stripe-webhook
**Purpose**: Handles Stripe webhook events for subscription management and payment processing.

**Events Handled**:
- `checkout.session.completed` - Creates/updates subscription when payment succeeds
- `customer.subscription.updated` - Updates subscription status and billing period
- `customer.subscription.deleted` - Marks subscription as canceled
- `invoice.payment_failed` - Handles failed payment attempts

**Email Notifications**: Automatically sends emails to `info@amalfi-alzira.es` for:
- New subscription created
- Subscription canceled
- Payment failed

**Environment Variables Required**:
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret from Stripe
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `RESEND_API_KEY` - Resend.com API key for sending emails

**Deployment**:
```bash
supabase functions deploy stripe-webhook
```

### 2. auth-webhook
**Purpose**: Handles user authentication events, specifically new user registrations.

**Events Handled**:
- User registration (INSERT on auth.users table)

**Email Notifications**: Sends registration notification to `info@amalfi-alzira.es` with:
- User email
- User ID
- Registration timestamp

**Environment Variables Required**:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `RESEND_API_KEY` - Resend.com API key for sending emails

**Setup**:
1. Deploy the function:
```bash
supabase functions deploy auth-webhook
```

2. Configure database webhook in Supabase Dashboard:
   - Go to Database → Webhooks
   - Create new webhook on `auth.users` table
   - Event: INSERT
   - URL: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/auth-webhook`

### 3. create-checkout-session
**Purpose**: Creates a Stripe Checkout session for subscription purchases.

**Usage**: Called from the frontend when user clicks "Subscribe Now"

**Environment Variables Required**:
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

**Deployment**:
```bash
supabase functions deploy create-checkout-session
```

### 4. create-portal-session
**Purpose**: Creates a Stripe Customer Portal session for subscription management.

**Usage**: Called from the frontend when user clicks "Manage Subscription"

**Environment Variables Required**:
- `STRIPE_SECRET_KEY` - Stripe API secret key

**Deployment**:
```bash
supabase functions deploy create-portal-session
```

## Shared Utilities

### _shared/email.ts
Shared email utility functions for sending notifications via Resend.com.

**Functions**:
- `sendNotificationEmail()` - Sends email using Resend API
- `formatUserRegistrationEmail()` - Formats registration email template
- `formatSubscriptionCreatedEmail()` - Formats subscription created email template
- `formatSubscriptionCanceledEmail()` - Formats subscription canceled email template
- `formatPaymentFailedEmail()` - Formats payment failed email template

All email templates are in Italian and styled with inline CSS for maximum compatibility.

## Environment Variables Setup

Set environment variables using Supabase Dashboard or CLI:

**Dashboard Method**:
1. Go to Settings → Edge Functions
2. Add environment variables in the Environment Variables section

**CLI Method**:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx
```

## Testing

### Test Locally
```bash
# Start Supabase locally
supabase start

# Serve a function locally
supabase functions serve stripe-webhook --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/stripe-webhook' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"test": true}'
```

### Test Webhooks

**Stripe Webhook**:
1. Use Stripe CLI for local testing:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

**Auth Webhook**:
1. Create a test user in your app
2. Check function logs in Supabase Dashboard
3. Verify email was sent in Resend dashboard

## Monitoring

### View Logs

**Supabase Dashboard**:
1. Go to Edge Functions
2. Select the function
3. Click Logs tab

**CLI**:
```bash
supabase functions logs stripe-webhook
```

### Email Delivery

Check email delivery status in [Resend Dashboard](https://resend.com/logs)

## Troubleshooting

### Function Not Deploying
- Check for syntax errors in TypeScript
- Verify all imports are correct
- Ensure function name matches directory name

### Webhook Not Triggering
- Verify webhook URL is correct
- Check webhook is enabled in Stripe/Supabase
- Review function logs for errors
- Verify environment variables are set

### Emails Not Sending
- Check `RESEND_API_KEY` is set correctly
- Verify API key is valid in Resend dashboard
- Check Resend logs for delivery failures
- Ensure email address is not blocked

### Database Errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check table schema matches expected structure
- Review RLS policies if queries fail

## Documentation

For detailed setup instructions, see:
- `docs/STRIPE_SETUP_GUIDE.md` - Stripe integration setup
- `docs/EMAIL_NOTIFICATIONS_SETUP.md` - Email notifications setup

## Security Notes

- ✅ All functions verify webhook signatures/authorization
- ✅ Service role key is only used server-side
- ✅ Sensitive data is never logged
- ✅ Environment variables are encrypted in Supabase
- ✅ CORS is configured to only allow your domain

## Support

If you encounter issues:
1. Check function logs in Supabase Dashboard
2. Review Stripe webhook logs
3. Check Resend email logs
4. Verify all environment variables are set
5. Consult the documentation files