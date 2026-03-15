-- Remove trial period from existing subscriptions
UPDATE user_subscriptions
SET 
  status = 'active',
  trial_end = NULL,
  current_period_start = CURRENT_TIMESTAMP,
  current_period_end = CURRENT_TIMESTAMP + INTERVAL '1 month'
WHERE status = 'trialing';

-- Drop the old trigger that creates trial subscriptions
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_subscription();

-- Create new trigger WITHOUT trial period
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create active subscription immediately (NO TRIAL)
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'inactive',  -- Start as inactive, will be activated after payment
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 month'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();
