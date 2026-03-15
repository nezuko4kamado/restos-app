-- Fix: Drop the problematic trigger that causes "Database error" during registration
-- The trigger fires on auth.users INSERT and tries to create a user_subscriptions record,
-- but can fail due to schema/enum mismatches, causing the entire registration to fail.

-- Step 1: Drop the existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- Step 2: Recreate the function with proper error handling
-- The BEGIN/EXCEPTION block ensures that if the INSERT fails, the user creation
-- still succeeds (the error is logged as a WARNING instead of aborting the transaction).
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id,
      subscription_type,
      status,
      current_period_start,
      current_period_end,
      scans_limit,
      products_limit,
      invoices_limit
    )
    VALUES (
      NEW.id,
      'free'::subscription_type_enum,
      'active'::subscription_status_enum,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + INTERVAL '1 year',
      10,
      20,
      10
    );
    RAISE NOTICE 'Successfully created subscription for user %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create subscription for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate the trigger
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();