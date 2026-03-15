-- Fix the trigger to properly handle ENUM types and NOT NULL constraints
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();