-- Migration: Fix conflicting triggers on auth.users
-- Issue: Two triggers trying to insert into user_subscriptions, one using deprecated 'trial' enum value
-- Solution: Update initialize_new_user to only handle user_settings, let handle_new_user_subscription handle subscriptions

-- Drop and recreate the initialize_new_user function to only handle user_settings
CREATE OR REPLACE FUNCTION public.initialize_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the trigger activation
  RAISE LOG 'Trigger initialize_new_user fired for user: %', NEW.id;
  
  -- Only insert user_settings, let the other trigger handle subscriptions
  BEGIN
    INSERT INTO public.user_settings (user_id, language, country)
    VALUES (NEW.id, 'it', 'IT')
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE LOG 'Successfully created user_settings for user: %', NEW.id;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't block user creation
      RAISE LOG 'Error creating user_settings for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      -- Don't raise exception, allow user creation to proceed
  END;
  
  RETURN NEW;
END;
$$;

-- Add comment to explain the function's purpose
COMMENT ON FUNCTION public.initialize_new_user() IS 
'Creates default user_settings record when a new user signs up. Subscriptions are handled by handle_new_user_subscription trigger.';

-- Verify both triggers are enabled
DO $$
BEGIN
  -- Check if triggers exist and are enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created' 
    AND tgrelid = 'auth.users'::regclass
    AND tgenabled = 'O'
  ) THEN
    RAISE NOTICE 'Trigger on_auth_user_created is not enabled or does not exist';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created_subscription' 
    AND tgrelid = 'auth.users'::regclass
    AND tgenabled = 'O'
  ) THEN
    RAISE NOTICE 'Trigger on_auth_user_created_subscription is not enabled or does not exist';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully';
END $$;