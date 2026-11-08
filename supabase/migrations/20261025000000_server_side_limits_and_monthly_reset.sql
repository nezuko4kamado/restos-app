-- Server-side subscription limits + scheduled monthly reset.
-- Rules (must match stripe-webhook getPlanLimits):
--   limit = -1          -> unlimited (Premium)
--   no subscription row -> unlimited (existing project constraint)
--   free: invoices counted in total; paid: invoices counted per calendar month (UTC)

-- 1. Products limit -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_products_limit()
RETURNS trigger AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT products_limit INTO v_limit
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id;

  IF v_limit IS NULL OR v_limit = -1 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.products WHERE user_id = NEW.user_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PRODUCT_LIMIT_REACHED: % of % products used', v_count, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_products_limit ON public.products;
CREATE TRIGGER trg_enforce_products_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_products_limit();

-- 2. Invoices limit -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_invoices_limit()
RETURNS trigger AS $$
DECLARE
  v_limit INTEGER;
  v_type  TEXT;
  v_count INTEGER;
BEGIN
  SELECT invoices_limit, subscription_type INTO v_limit, v_type
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id;

  IF v_limit IS NULL OR v_limit = -1 THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_type, 'free') = 'free' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.app_43909_invoices WHERE user_id = NEW.user_id;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM public.app_43909_invoices
    WHERE user_id = NEW.user_id
      AND created_at >= date_trunc('month', NOW());
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'INVOICE_LIMIT_REACHED: % of % invoices used', v_count, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_invoices_limit ON public.app_43909_invoices;
CREATE TRIGGER trg_enforce_invoices_limit
  BEFORE INSERT ON public.app_43909_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoices_limit();

-- 3. Monthly reset ------------------------------------------------------------
-- The previous version only reset rows with current_period_end < NOW(), which never
-- matched paid users (Stripe renewals move current_period_end forward) and was not
-- scheduled at all. Reset now runs on the 1st of each month, aligned with the
-- calendar-month invoice counting used by the app and the trigger above.
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS void AS $$
BEGIN
  -- Paid plans: monthly scans and invoices
  UPDATE public.user_subscriptions
  SET scans_used = 0,
      invoices_this_month = 0,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE subscription_type <> 'free';

  -- Free plan: scans are lifetime, only the invoice counter is reset
  UPDATE public.user_subscriptions
  SET invoices_this_month = 0,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE subscription_type = 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'reset-monthly-usage';
  PERFORM cron.schedule('reset-monthly-usage', '5 0 1 * *', 'SELECT public.reset_monthly_usage();');
END $$;
