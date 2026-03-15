-- Remove 'trial' from subscription_type_enum completely
-- This migration ensures the database only supports 'paid' and 'free_lifetime'

BEGIN;

-- Step 1: Remove default constraint temporarily
ALTER TABLE user_subscriptions ALTER COLUMN subscription_type DROP DEFAULT;

-- Step 2: Create new ENUM without 'trial'
CREATE TYPE subscription_type_enum_new AS ENUM ('paid', 'free_lifetime');

-- Step 3: Convert existing data (if any 'trial' exists, convert to 'paid')
UPDATE user_subscriptions 
SET subscription_type = 'paid'::text 
WHERE subscription_type::text = 'trial';

-- Step 4: Convert column to new ENUM type
ALTER TABLE user_subscriptions 
  ALTER COLUMN subscription_type TYPE subscription_type_enum_new 
  USING subscription_type::text::subscription_type_enum_new;

-- Step 5: Drop old ENUM type
DROP TYPE subscription_type_enum;

-- Step 6: Rename new ENUM to original name
ALTER TYPE subscription_type_enum_new RENAME TO subscription_type_enum;

-- Step 7: Re-add default constraint with new ENUM
ALTER TABLE user_subscriptions 
  ALTER COLUMN subscription_type SET DEFAULT 'paid'::subscription_type_enum;

-- Step 8: Update trigger function to ensure it only uses 'paid'
DROP FUNCTION IF EXISTS public.handle_new_user_subscription() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create suspended subscription for new user (will be activated after payment)
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
    -- Log the error for debugging
    RAISE WARNING 'Error in handle_new_user_subscription: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();

COMMIT;