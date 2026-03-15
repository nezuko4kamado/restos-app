-- Create ENUM types for subscription_type and status
DO $$ BEGIN
    CREATE TYPE subscription_type_enum AS ENUM ('paid', 'free_lifetime', 'trial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'inactive', 'suspended', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop ALL constraints on these columns first
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_type_check;
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

-- Remove default constraints before converting to ENUM
ALTER TABLE user_subscriptions ALTER COLUMN subscription_type DROP DEFAULT;
ALTER TABLE user_subscriptions ALTER COLUMN status DROP DEFAULT;

-- Convert subscription_type column to ENUM
ALTER TABLE user_subscriptions 
    ALTER COLUMN subscription_type TYPE subscription_type_enum 
    USING subscription_type::text::subscription_type_enum;

-- Convert status column to ENUM
ALTER TABLE user_subscriptions 
    ALTER COLUMN status TYPE subscription_status_enum 
    USING status::text::subscription_status_enum;

-- Re-add default values with ENUM types
ALTER TABLE user_subscriptions ALTER COLUMN subscription_type SET DEFAULT 'paid'::subscription_type_enum;
ALTER TABLE user_subscriptions ALTER COLUMN status SET DEFAULT 'suspended'::subscription_status_enum;

-- Update the trigger function to explicitly cast to ENUM types
DROP FUNCTION IF EXISTS public.handle_new_user_subscription() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create suspended subscription for new user (will be activated after payment)
  INSERT INTO public.user_subscriptions (
    user_id,
    subscription_type,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'paid'::subscription_type_enum,
    'suspended'::subscription_status_enum,
    NULL,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();