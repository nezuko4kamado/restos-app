-- Fix schema mismatch for user registration
-- Add 'inactive' to allowed status values
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_status_check 
  CHECK (status IN ('active', 'inactive', 'expired', 'suspended'));

-- Drop and recreate the trigger with correct column names
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_subscription();

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create suspended subscription for new user (will be activated after payment)
  INSERT INTO public.user_subscriptions (
    user_id,
    subscription_type,
    status,
    trial_end_date,
    subscription_end_date
  ) VALUES (
    NEW.id,
    'paid',
    'suspended',
    NULL,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();