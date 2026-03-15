-- Update reset_monthly_usage to NOT reset scans for free users
-- Free plan scans are TOTAL (lifetime), not monthly
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