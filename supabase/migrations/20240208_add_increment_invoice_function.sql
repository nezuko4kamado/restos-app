-- Create function to increment invoice count
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