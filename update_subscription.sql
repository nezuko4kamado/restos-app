-- Update existing subscription to paid type
-- This script updates the subscription for the current user to show as 'paid' instead of 'trial'

-- First, let's see the current subscription status
SELECT 
  u.email,
  s.subscription_type,
  s.status,
  s.stripe_subscription_id,
  s.current_period_end
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.stripe_subscription_id IS NOT NULL;

-- Update the subscription to paid type
UPDATE user_subscriptions
SET 
  subscription_type = 'paid',
  status = 'active',
  updated_at = NOW()
WHERE stripe_subscription_id IS NOT NULL
  AND subscription_type = 'trial';

-- Verify the update
SELECT 
  u.email,
  s.subscription_type,
  s.status,
  s.stripe_subscription_id,
  s.current_period_end,
  s.updated_at
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.stripe_subscription_id IS NOT NULL;
