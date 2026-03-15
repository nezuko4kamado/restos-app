# Stripe Integration Setup Guide

This guide will help you set up Stripe payment integration for your restaurant management application.

## ⚠️ SECURITY WARNING

**CRITICAL:** The Stripe Secret Key provided is a **LIVE PRODUCTION KEY**. This means:
- All payments will be REAL transactions
- Real money will be charged to customers
- Never commit these keys to Git or expose them publicly
- Store them only in secure environment variables
- Rotate keys immediately if they are ever exposed

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Supabase project with Edge Functions enabled
3. Access to your Supabase dashboard

## Step 1: Configure Supabase Environment Variables

**IMPORTANT:** These are LIVE production keys. Handle with extreme care.

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:

```bash
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_51NAwxJERHOOWoH8ZArl1PQy7pw9zr6ZoOCb8rNwuPq5NDtxs3jgsT3sxmgl0xbjWCoQsI9ZpRXerqBg5lUUgfFjb00SPRnH7yU
```

**Note:** The webhook secret will be added in Step 4 after creating the webhook endpoint.

## Step 2: Verify Stripe Products and Prices

Your Stripe account already has the following products configured:

### Basic Plan
- **Price ID:** `price_1Sro9hERHOOWoH8ZAusBoEDS`
- **Amount:** $9.99/month
- **Features:** 50 scans/month, 100 products, 50 invoices, Email support

### Pro Plan
- **Price ID:** `price_1SroFeERHOOWoH8ZzKxaihdT`
- **Amount:** $19.99/month
- **Features:** 200 scans/month, 500 products, 200 invoices, Priority support

### Premium Plan
- **Price ID:** `price_1SroIRERHOOWoH8Zyi6tTBGy`
- **Amount:** $49.99/month
- **Features:** Unlimited scans, products, and invoices, Dedicated support

✅ These Price IDs are already configured in `src/components/SubscriptionManager.tsx`

## Step 3: Deploy Supabase Edge Functions

Deploy the Edge Functions to Supabase:

```bash
# Navigate to your project directory
cd /workspace/shadcn-ui

# Deploy create-checkout-session function
supabase functions deploy create-checkout-session

# Deploy create-portal-session function
supabase functions deploy create-portal-session

# Deploy stripe-webhook function
supabase functions deploy stripe-webhook
```

## Step 4: Run Database Migration

Apply the subscription database schema:

```bash
# Using Supabase CLI (recommended)
supabase db push

# Or connect directly to your database
psql $DATABASE_URL -f supabase/migrations/20250128000000_create_subscriptions_table.sql
```

This will create:
- `user_subscriptions` table with all necessary fields
- Subscription type and status enums
- Usage tracking columns (scans, products, invoices)
- Row Level Security policies
- Helper functions for limit checking
- Automatic triggers for new user registration

## Step 5: Set Up Stripe Webhook

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```
   Replace `YOUR_PROJECT_REF` with your actual Supabase project reference.

4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_failed`

5. Click **Add endpoint**

6. Copy the **Signing secret** (starts with `whsec_`)

7. Add it to Supabase secrets:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

## Step 6: Test the Integration

### ⚠️ PRODUCTION TESTING WARNING

Since you're using LIVE keys, all test transactions will be REAL charges:

1. **Use a test credit card** that you control
2. **Small amounts only** for testing
3. **Immediately cancel** test subscriptions after verification
4. **Refund test charges** through Stripe Dashboard

### Testing Flow

1. Log in to your application
2. Navigate to the Subscription/Dashboard page
3. Click "Subscribe" on any plan
4. Complete the Stripe Checkout with a real card (small test amount)
5. Verify the subscription status updates in your dashboard
6. Test the "Manage Subscription" button to access the customer portal
7. **Cancel the test subscription immediately**
8. **Issue a refund** through Stripe Dashboard

### Verification Checklist

- ✅ Checkout session creates successfully
- ✅ Payment processes through Stripe
- ✅ Webhook receives `checkout.session.completed` event
- ✅ Database updates with subscription details
- ✅ User dashboard shows active subscription
- ✅ Usage limits are enforced
- ✅ Customer portal opens correctly
- ✅ Subscription cancellation works

## Step 7: Monitor and Maintain

### Regular Monitoring

1. **Stripe Dashboard** → **Payments**: Monitor all transactions
2. **Stripe Dashboard** → **Subscriptions**: Track active subscriptions
3. **Stripe Dashboard** → **Webhooks**: Check webhook delivery status
4. **Supabase Dashboard** → **Database**: Verify subscription data sync

### Monthly Tasks

- Review failed payments and retry logic
- Check webhook delivery success rate
- Monitor subscription churn rate
- Verify usage limit enforcement
- Review customer support tickets

## Security Best Practices

### Key Management

1. ✅ **Never commit keys to Git**
   - Add `.env` files to `.gitignore`
   - Use environment variables only
   - Store in Supabase secrets

2. ✅ **Rotate keys regularly**
   - Change keys every 90 days minimum
   - Rotate immediately if exposed
   - Update all services after rotation

3. ✅ **Limit key access**
   - Only authorized team members
   - Use separate keys per environment
   - Audit key usage regularly

4. ✅ **Monitor for suspicious activity**
   - Enable Stripe Radar for fraud detection
   - Set up alerts for unusual patterns
   - Review failed payment attempts

### Webhook Security

1. **Always verify webhook signatures**
   - The code already implements this
   - Never skip signature verification
   - Use the correct webhook secret

2. **Use HTTPS only**
   - Supabase Edge Functions use HTTPS by default
   - Never expose webhooks over HTTP

3. **Implement idempotency**
   - Handle duplicate webhook events
   - Use event IDs to prevent double-processing

## Troubleshooting

### Webhook Not Receiving Events

**Check:**
- Webhook URL is correct and accessible
- Webhook secret matches in Supabase
- Events are selected in Stripe Dashboard
- No firewall blocking requests

**Debug:**
```bash
# View webhook logs in Stripe Dashboard
Developers → Webhooks → [Your endpoint] → Events

# View Edge Function logs in Supabase
Edge Functions → stripe-webhook → Logs
```

### Checkout Session Not Creating

**Check:**
- User is authenticated
- Stripe API keys are correct
- Price IDs match your Stripe products
- Edge Function is deployed

**Debug:**
```bash
# View Edge Function logs
supabase functions logs create-checkout-session
```

### Subscription Not Updating

**Check:**
- Webhook is receiving events
- Database permissions (RLS policies)
- User ID matches between systems
- Stripe customer ID is stored

**Debug:**
```bash
# Check database directly
SELECT * FROM user_subscriptions WHERE user_id = 'USER_ID';

# View webhook processing logs
supabase functions logs stripe-webhook
```

### Payment Failures

**Common causes:**
- Insufficient funds
- Card declined by issuer
- Incorrect card details
- 3D Secure authentication failed

**Resolution:**
- Customer updates payment method in portal
- Retry failed payment in Stripe Dashboard
- Contact customer for alternative payment

## Support Resources

- **Stripe Documentation:** https://stripe.com/docs
- **Supabase Documentation:** https://supabase.com/docs
- **Stripe Support:** https://support.stripe.com
- **Application Support:** Use the contact form in your app

## Additional Features to Consider

Future enhancements you might want to implement:

1. **Proration** - Automatic credit/charge when upgrading/downgrading
2. **Annual Billing** - Offer discounts for yearly subscriptions
3. **Free Trials** - 7-14 day trial periods before charging
4. **Coupon Codes** - Promotional discounts and referral codes
5. **Usage-Based Billing** - Charge based on actual usage
6. **Multiple Payment Methods** - Support cards, bank transfers, etc.
7. **Invoice Emails** - Automatic receipt delivery
8. **Dunning Management** - Automated retry for failed payments

## Compliance Notes

Ensure your application complies with:

- **PCI DSS** - Stripe handles card data, but follow best practices
- **GDPR** - If serving EU customers, handle data properly
- **Local Tax Laws** - Configure tax collection in Stripe
- **Terms of Service** - Clear subscription terms and cancellation policy
- **Privacy Policy** - Explain how payment data is handled

---

## Quick Reference

**Live Stripe Keys (PRODUCTION):**
- Secret Key: `sk_live_51NAwxJERHOOWoH8Z...` (stored in Supabase secrets)
- Publishable Key: `pk_live_51NAwxJERHOOWoH8Z...` (stored in Supabase secrets)

**Price IDs:**
- Basic: `price_1Sro9hERHOOWoH8ZAusBoEDS`
- Pro: `price_1SroFeERHOOWoH8ZzKxaihdT`
- Premium: `price_1SroIRERHOOWoH8Zyi6tTBGy`

**Important URLs:**
- Stripe Dashboard: https://dashboard.stripe.com
- Supabase Dashboard: https://app.supabase.com
- Webhook Endpoint: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`

---

**Last Updated:** 2025-01-28
**Version:** 1.0 (Production)