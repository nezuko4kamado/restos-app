-- Migration: Create User Subscriptions Table for Stripe Integration
-- Created: 2025-01-28

BEGIN;

-- ============================================================================
-- 1. CREATE ENUMS
-- ============================================================================

-- Subscription type enum
DO $$ BEGIN
    CREATE TYPE subscription_type_enum AS ENUM ('free', 'basic', 'pro', 'premium', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription status enum
DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'inactive', 'canceled', 'past_due', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. CREATE USER_SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Stripe fields
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    
    -- Subscription details
    subscription_type subscription_type_enum DEFAULT 'free'::subscription_type_enum NOT NULL,
    status subscription_status_enum DEFAULT 'inactive'::subscription_status_enum NOT NULL,
    
    -- Billing periods
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    scans_used INTEGER DEFAULT 0,
    scans_limit INTEGER DEFAULT 50,
    products_saved INTEGER DEFAULT 0,
    products_limit INTEGER DEFAULT 100,
    invoices_this_month INTEGER DEFAULT 0,
    invoices_limit INTEGER DEFAULT 50,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_customer_id_idx ON public.user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_id_idx ON public.user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS user_subscriptions_subscription_type_idx ON public.user_subscriptions(subscription_type);

-- ============================================================================
-- 4. ENABLE RLS
-- ============================================================================

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can read own subscription" ON public.user_subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can update their own subscription (for usage tracking)
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role can do everything (for Stripe webhooks)
CREATE POLICY "Service role can manage all subscriptions" ON public.user_subscriptions
    FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- 5. CREATE FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Create free subscription for new users
    INSERT INTO public.user_subscriptions (
        user_id,
        subscription_type,
        status,
        current_period_start,
        current_period_end,
        scans_limit,
        products_limit,
        invoices_limit
    ) VALUES (
        NEW.id,
        'free'::subscription_type_enum,
        'active'::subscription_status_enum,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '1 year',
        10,
        20,
        10
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly usage counters
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
    -- For paid plans: reset both scans and invoices
    UPDATE public.user_subscriptions
    SET 
        scans_used = 0,
        invoices_this_month = 0,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE status = 'active'
    AND subscription_type != 'free'
    AND current_period_end < CURRENT_TIMESTAMP;

    -- For free plan: only reset invoices (scans are total, not monthly)
    UPDATE public.user_subscriptions
    SET 
        invoices_this_month = 0,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE status = 'active'
    AND subscription_type = 'free'
    AND current_period_end < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has reached limits
CREATE OR REPLACE FUNCTION check_subscription_limits(
    p_user_id UUID,
    p_limit_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_subscription RECORD;
    v_has_limit BOOLEAN;
BEGIN
    SELECT * INTO v_subscription
    FROM public.user_subscriptions
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check specific limit type
    CASE p_limit_type
        WHEN 'scans' THEN
            v_has_limit := (v_subscription.scans_limit = -1 OR v_subscription.scans_used < v_subscription.scans_limit);
        WHEN 'products' THEN
            v_has_limit := (v_subscription.products_limit = -1 OR v_subscription.products_saved < v_subscription.products_limit);
        WHEN 'invoices' THEN
            v_has_limit := (v_subscription.invoices_limit = -1 OR v_subscription.invoices_this_month < v_subscription.invoices_limit);
        ELSE
            v_has_limit := false;
    END CASE;
    
    RETURN v_has_limit AND v_subscription.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. CREATE TRIGGERS
-- ============================================================================

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_subscriptions_updated_at();

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_subscription();

COMMIT;