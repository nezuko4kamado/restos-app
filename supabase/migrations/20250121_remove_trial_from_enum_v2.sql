-- Remove 'trial' from subscription_type_enum
-- This approach converts the column to text first, then back to a new ENUM

BEGIN;

-- Step 1: Convert any existing 'trial' values to 'paid'
-- We need to cast properly since it's already an ENUM
UPDATE user_subscriptions 
SET subscription_type = 'paid'::subscription_type_enum
WHERE subscription_type = 'trial'::subscription_type_enum;

-- Step 2: Remove default temporarily
ALTER TABLE user_subscriptions ALTER COLUMN subscription_type DROP DEFAULT;

-- Step 3: Convert column to TEXT temporarily
ALTER TABLE user_subscriptions 
  ALTER COLUMN subscription_type TYPE TEXT;

-- Step 4: Create new ENUM without 'trial'
DROP TYPE IF EXISTS subscription_type_enum CASCADE;
CREATE TYPE subscription_type_enum AS ENUM ('paid', 'free_lifetime');

-- Step 5: Convert column back to new ENUM
ALTER TABLE user_subscriptions 
  ALTER COLUMN subscription_type TYPE subscription_type_enum 
  USING subscription_type::subscription_type_enum;

-- Step 6: Re-add default
ALTER TABLE user_subscriptions 
  ALTER COLUMN subscription_type SET DEFAULT 'paid'::subscription_type_enum;

-- Step 7: Recreate trigger function
DROP FUNCTION IF EXISTS public.handle_new_user_subscription() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (
    user_id,
    subscription_type,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    trial_end,
    cancel_at_period_end
  ) VALUES (
    NEW.id,
    'paid'::subscription_type_enum,
    'suspended'::subscription_status_enum,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    false
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user_subscription: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();

COMMIT;