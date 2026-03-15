-- Fix existing users' subscription limits to match the correct plan values
-- This ensures all existing users have the right limits, not just new registrations

-- Update FREE plan users
UPDATE public.user_subscriptions
SET 
  scans_limit = 10,
  products_limit = 20,
  invoices_limit = 10
WHERE subscription_type = 'free';

-- Update BASIC plan users
UPDATE public.user_subscriptions
SET 
  scans_limit = 20,
  products_limit = 40,
  invoices_limit = 20
WHERE subscription_type = 'basic';

-- Update PRO plan users
UPDATE public.user_subscriptions
SET 
  scans_limit = 50,
  products_limit = 100,
  invoices_limit = 50
WHERE subscription_type = 'pro';

-- Update PREMIUM plan users (unlimited = -1)
UPDATE public.user_subscriptions
SET 
  scans_limit = -1,
  products_limit = -1,
  invoices_limit = -1
WHERE subscription_type = 'premium';
