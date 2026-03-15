# Stripe Integration Setup Guide

This guide walks you through setting up Stripe payment integration for subscription management.

## Prerequisites

- A Stripe account (sign up at [stripe.com](https://stripe.com))
- Supabase project with Edge Functions enabled
- The subscription database table created (see migration files)

## Step 1: Get Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Click on **Developers** in the left sidebar
3. Go to **API keys**
4. You'll see two types of keys:
   - **Publishable key** (starts with `pk_test_` for test mode)
   - **Secret key** (starts with `sk_test_` for test mode)
5. Copy both keys - you'll need them later

⚠️ **Important**: Use test mode keys during development. Switch to live mode keys only when ready for production.

## Step 2: Create Stripe Products and Prices

1. In Stripe Dashboard, go to **Products**
2. Click **Add product**
3. Fill in:
   - **Name**: e.g., "Monthly Subscription"
   - **Description**: Optional description
   - **Pricing**: 
     - Choose **Recurring**
     - Set your price (e.g., €9.99)
     - Billing period: **Monthly**
4. Click **Save product**
5. Copy the **Price ID** (starts with `price_`) - you'll need this

Repeat for any additional subscription tiers you want to offer.

## Step 3: Set Up Stripe Webhook

### 3.1 Get Your Supabase Function URL

Your webhook URL will be:
```
https://[YOUR_PROJECT_REF].supabase.co/functions/v1/stripe-webhook
```

To find your project ref:
1. Go to your Supabase project dashboard
2. Look at the URL - it's the part after `https://supabase.com/dashboard/project/`
3. Or go to **Settings** → **API** and find it in the URL section

### 3.2 Create Webhook in Stripe

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/stripe-webhook`
4. Click **Select events**
5. Choose these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
6. Click **Add events**
7. Click **Add endpoint**

### 3.3 Get Webhook Signing Secret

1. After creating the webhook, click on it
2. In the **Signing secret** section, click **Reveal**
3. Copy the signing secret (starts with `whsec_`)

## Step 4: Configure Environment Variables

### 4.1 Add to Supabase

You need to add these environment variables to your Supabase project:

**Using Supabase Dashboard:**
1. Go to **Settings** → **Edge Functions**
2. Scroll to **Environment Variables**
3. Add each variable:

```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Using Supabase CLI:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 4.2 Add to Your Application

Create or update `.env.local` file in your project root:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxx
```

⚠️ **Never commit `.env.local` to version control!** It's already in `.gitignore`.

## Step 5: Deploy Edge Functions

Deploy the Stripe webhook handler to Supabase:

```bash
# Make sure you're in the project directory
cd /workspace/shadcn-ui

# Deploy the stripe-webhook function
supabase functions deploy stripe-webhook

# Deploy the create-checkout-session function
supabase functions deploy create-checkout-session

# Deploy the create-portal-session function
supabase functions deploy create-portal-session
```

## Step 6: Update Price ID in Code

Open `src/components/PaymentSection.tsx` and update the `PRICE_ID` constant with your Stripe Price ID:

```typescript
const PRICE_ID = 'price_xxxxxxxxxxxxx'; // Replace with your actual Price ID
```

## Step 7: Test the Integration

### 7.1 Test Subscription Creation

1. Start your development server: `pnpm run dev`
2. Log in to your application
3. Go to Settings → Payment
4. Click "Subscribe Now"
5. Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code
6. Complete the checkout

### 7.2 Verify in Stripe Dashboard

1. Go to Stripe Dashboard → **Payments**
2. You should see the test payment
3. Go to **Customers** → **Subscriptions**
4. Verify the subscription was created

### 7.3 Verify in Supabase

1. Go to Supabase Dashboard → **Table Editor**
2. Open the `user_subscriptions` table
3. You should see a new row with your subscription details

### 7.4 Test Webhook

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. You should see successful events logged
4. If there are errors, check the **Logs** tab in Supabase Edge Functions

## Step 8: Test Subscription Management

### Cancel Subscription
1. In your app, go to Settings → Payment
2. Click "Manage Subscription"
3. This opens Stripe Customer Portal
4. Click "Cancel subscription"
5. Verify the status updates in your app

### Update Payment Method
1. In Customer Portal, click "Update payment method"
2. Enter new test card details
3. Save changes

## Step 9: Email Notifications Setup

The system automatically sends email notifications for subscription events. See `EMAIL_NOTIFICATIONS_SETUP.md` for detailed setup instructions.

Email notifications are sent for:
- New user registrations
- New subscriptions created
- Subscriptions canceled
- Payment failures

## Common Issues and Solutions

### Issue: Webhook not receiving events

**Solution:**
1. Check that your Supabase function URL is correct
2. Verify the webhook is enabled in Stripe Dashboard
3. Check Supabase function logs for errors
4. Ensure `STRIPE_WEBHOOK_SECRET` is set correctly

### Issue: "Invalid signature" error

**Solution:**
1. Verify your `STRIPE_WEBHOOK_SECRET` matches the one in Stripe Dashboard
2. Make sure you copied the entire secret including `whsec_` prefix
3. Redeploy the Edge Function after updating the secret

### Issue: Subscription not appearing in database

**Solution:**
1. Check Supabase function logs for errors
2. Verify the `user_subscriptions` table exists and has correct schema
3. Check that the webhook events are being sent (Stripe Dashboard → Webhooks → Events)
4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function environment

### Issue: Checkout session not creating

**Solution:**
1. Verify `STRIPE_SECRET_KEY` is set correctly
2. Check that the Price ID in your code matches your Stripe product
3. Look at browser console for errors
4. Check Supabase function logs

## Going to Production

When ready to launch:

1. **Switch to Live Mode in Stripe:**
   - Get live API keys (start with `pk_live_` and `sk_live_`)
   - Create live products and prices
   - Set up live webhook endpoint

2. **Update Environment Variables:**
   - Replace test keys with live keys in Supabase
   - Update `.env.local` with live publishable key
   - Update Price ID in code with live price ID

3. **Test Thoroughly:**
   - Use real payment methods
   - Verify all webhook events work
   - Test subscription lifecycle (create, update, cancel)
   - Verify email notifications are working

4. **Enable Stripe Radar:**
   - Set up fraud prevention rules
   - Configure 3D Secure settings

5. **Set Up Monitoring:**
   - Enable Stripe email notifications for failed payments
   - Set up alerts in Supabase for function errors
   - Monitor Resend email delivery

## Security Best Practices

- ✅ Never expose secret keys in client-side code
- ✅ Always verify webhook signatures
- ✅ Use environment variables for all sensitive data
- ✅ Enable Stripe Radar for fraud prevention
- ✅ Regularly rotate API keys
- ✅ Monitor webhook logs for suspicious activity
- ✅ Use HTTPS for all webhook endpoints

## Support Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Testing](https://stripe.com/docs/testing)
- Email Notifications: See `EMAIL_NOTIFICATIONS_SETUP.md`

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] All environment variables are set correctly
- [ ] Edge Functions are deployed successfully
- [ ] Webhook endpoint URL is correct
- [ ] Webhook events are selected in Stripe
- [ ] Database table exists with correct schema
- [ ] Using correct API keys (test vs live)
- [ ] Price ID matches your Stripe product
- [ ] Browser console shows no errors
- [ ] Supabase function logs show no errors
- [ ] Email notifications are configured (see EMAIL_NOTIFICATIONS_SETUP.md)