-- ============================================
-- COMPLETE SUBSCRIPTION CLEANUP SCRIPT
-- ============================================
-- This script removes ALL subscription-related:
-- 1. Tables
-- 2. Functions
-- 3. Triggers
-- 4. Policies
-- 5. Enums
-- ============================================

BEGIN;

-- Step 1: Drop all triggers related to subscriptions
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP TRIGGER IF EXISTS create_subscription_on_signup ON auth.users;
DROP TRIGGER IF EXISTS auto_create_subscription ON auth.users;

-- Step 2: Drop all functions related to subscriptions
DROP FUNCTION IF EXISTS handle_new_user_subscription() CASCADE;
DROP FUNCTION IF EXISTS create_user_subscription() CASCADE;
DROP FUNCTION IF EXISTS auto_create_user_subscription() CASCADE;
DROP FUNCTION IF EXISTS check_subscription_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_subscription(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_subscription_status() CASCADE;

-- Step 3: Drop the user_subscriptions table (this will cascade and remove all policies)
DROP TABLE IF EXISTS user_subscriptions CASCADE;

-- Step 4: Drop subscription-related enums
DROP TYPE IF EXISTS subscription_type_enum CASCADE;
DROP TYPE IF EXISTS subscription_status_enum CASCADE;

-- Step 5: Remove subscription-related columns from other tables (if any)
-- Check profiles table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
        ALTER TABLE profiles DROP COLUMN subscription_status;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'subscription_tier') THEN
        ALTER TABLE profiles DROP COLUMN subscription_tier;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'is_premium') THEN
        ALTER TABLE profiles DROP COLUMN is_premium;
    END IF;
END $$;

-- Check user_settings table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'user_settings' AND column_name = 'subscription_status') THEN
        ALTER TABLE user_settings DROP COLUMN subscription_status;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'user_settings' AND column_name = 'subscription_tier') THEN
        ALTER TABLE user_settings DROP COLUMN subscription_tier;
    END IF;
END $$;

COMMIT;

-- Verification queries
SELECT 'Tables with "subscription" in name:' as check_type;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%subscription%';

SELECT 'Functions with "subscription" in name:' as check_type;
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%subscription%';

SELECT 'Triggers with "subscription" in name:' as check_type;
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name LIKE '%subscription%';

SELECT 'Enums with "subscription" in name:' as check_type;
SELECT typname 
FROM pg_type 
WHERE typname LIKE '%subscription%';

SELECT '✅ Subscription cleanup completed!' as status;