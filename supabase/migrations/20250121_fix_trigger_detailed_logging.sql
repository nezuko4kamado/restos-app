-- Migration: Fix trigger with detailed logging and proper error handling
-- Date: 2025-01-21
-- Description: Replace the trigger function with better error handling and logging

BEGIN;

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- Create improved trigger function with detailed logging
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log the trigger activation
  RAISE LOG 'Trigger handle_new_user_subscription fired for user: %', NEW.id;
  
  -- Attempt to insert with only required fields
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id,
      subscription_type,
      status
    ) VALUES (
      NEW.id,
      'paid'::subscription_type_enum,
      'suspended'::subscription_status_enum
    );
    
    RAISE LOG 'Successfully created subscription for user: %', NEW.id;
    
  EXCEPTION
    WHEN unique_violation THEN
      -- User already has a subscription, this is OK
      RAISE LOG 'Subscription already exists for user: %', NEW.id;
      RETURN NEW;
      
    WHEN foreign_key_violation THEN
      -- Foreign key violation - user doesn't exist yet in auth.users
      RAISE LOG 'Foreign key violation for user: % - Error: %', NEW.id, SQLERRM;
      RAISE EXCEPTION 'Foreign key violation: %', SQLERRM;
      
    WHEN check_violation THEN
      -- Check constraint violation
      RAISE LOG 'Check constraint violation for user: % - Error: %', NEW.id, SQLERRM;
      RAISE EXCEPTION 'Check constraint violation: %', SQLERRM;
      
    WHEN not_null_violation THEN
      -- NOT NULL constraint violation
      RAISE LOG 'NOT NULL violation for user: % - Error: %', NEW.id, SQLERRM;
      RAISE EXCEPTION 'NOT NULL violation: %', SQLERRM;
      
    WHEN OTHERS THEN
      -- Catch all other errors
      RAISE LOG 'Unexpected error creating subscription for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      RAISE EXCEPTION 'Database error saving new user: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_subscription();

-- Verify RLS policies are in place
DO $$
BEGIN
  -- Check if the policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_subscriptions' 
    AND policyname = 'Allow trigger to insert subscriptions'
  ) THEN
    -- Create policy to allow postgres role (used by triggers) to insert
    CREATE POLICY "Allow trigger to insert subscriptions"
      ON user_subscriptions
      FOR INSERT
      TO postgres
      WITH CHECK (true);
    
    RAISE NOTICE 'Created RLS policy: Allow trigger to insert subscriptions';
  ELSE
    RAISE NOTICE 'RLS policy already exists: Allow trigger to insert subscriptions';
  END IF;
END $$;

COMMIT;