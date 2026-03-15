-- Migration: Add missing increment_scan_count, increment_product_count, and increment_invoice_count RPC functions
-- These functions are called from the frontend but were never created in the database
-- This is why the scan/product/invoice counters stay at zero

-- ============================================================================
-- 1. CREATE increment_scan_count FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_scan_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET scans_used = scans_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_scan_count(UUID) TO authenticated;

-- ============================================================================
-- 2. CREATE increment_product_count FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_product_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET products_saved = products_saved + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_product_count(UUID) TO authenticated;

-- ============================================================================
-- 3. CREATE increment_invoice_count FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_invoice_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET invoices_this_month = invoices_this_month + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_invoice_count(UUID) TO authenticated;