-- Drop and recreate the trigger with subscription_type
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_subscription();

-- Create the updated function WITH subscription_type
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create inactive subscription for new user
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    subscription_type,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'inactive',
    'paid',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 month'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();