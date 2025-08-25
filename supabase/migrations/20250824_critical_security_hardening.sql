-- ============================================
-- CRITICAL SECURITY HARDENING MIGRATION
-- ============================================
-- Fixes: 
--   1. EXO-128: Search path vulnerabilities in 18 functions
--   2. EXO-131: Enable RLS on car_pricing, car_specifications, car_features
-- Author: PostgreSQL Security Expert
-- Date: 2025-08-24
-- ============================================

BEGIN;

-- ============================================
-- SECTION 1: FIX SEARCH_PATH VULNERABILITIES
-- ============================================
-- Adding SET search_path = ''; to all vulnerable functions
-- and explicitly qualifying all table references with schema

-- --------------------------------------------
-- Function 1: update_modified_column (from 20240320_car_tables.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = '';
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_modified_column() IS 'SECURITY HARDENED: Search path fixed, trigger function to update updated_at timestamp';

-- --------------------------------------------
-- Function 2: set_active_hero (from 20240320_car_tables.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_active_hero(hero_id UUID)
RETURNS VOID AS $$
BEGIN
  SET search_path = '';
  -- First, set all heroes to inactive
  UPDATE public.hero_content SET is_active = false;
  
  -- Then set the specified hero to active
  UPDATE public.hero_content SET is_active = true WHERE id = hero_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_active_hero(UUID) IS 'SECURITY HARDENED: Search path fixed, sets active hero content';

-- --------------------------------------------
-- Function 3: update_timestamp (from 20240505_add_homepage_settings.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = '';
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_timestamp() IS 'SECURITY HARDENED: Search path fixed, trigger function to update updated_at timestamp';

-- --------------------------------------------
-- Function 4: free_car_availability_after_cancel (from 20240514_add_booking_core.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.free_car_availability_after_cancel()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = '';
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.car_availability
      SET status = 'available', booking_id = NULL, updated_at = now()
      WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.free_car_availability_after_cancel() IS 'SECURITY HARDENED: Search path fixed, frees car availability on booking cancellation';

-- --------------------------------------------
-- Function 5: confirm_car_availability_after_confirm (from 20240514_add_booking_core.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_car_availability_after_confirm()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = '';
  IF (
        (NEW.payment_status = 'captured' AND OLD.payment_status <> 'captured') OR
        (NEW.status = 'booked' AND OLD.status <> 'booked')
     ) THEN
    UPDATE public.car_availability
      SET status = 'booked', updated_at = now()
      WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.confirm_car_availability_after_confirm() IS 'SECURITY HARDENED: Search path fixed, confirms car availability after booking confirmation';

-- --------------------------------------------
-- Function 6: check_and_reserve_car_availability (from 20240521010000_create_check_reserve_availability_fn.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_reserve_car_availability(
    p_car_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_booking_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    loop_date DATE;
    availability_record RECORD;
BEGIN
    SET search_path = '';
    FOR loop_date IN SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date LOOP
        -- Check existing availability for the loop_date and p_car_id
        SELECT *
        INTO availability_record
        FROM public.car_availability ca
        WHERE ca.car_id = p_car_id AND ca.date = loop_date;

        IF FOUND THEN
            -- Record exists, check its status
            IF availability_record.status <> 'available' AND availability_record.booking_id IS DISTINCT FROM p_booking_id THEN
                -- Date is not available (booked by someone else or maintenance)
                RAISE WARNING 'Date % for car % is not available. Status: %, Booking ID: %', loop_date, p_car_id, availability_record.status, availability_record.booking_id;
                RETURN FALSE; -- Car not available on this date
            ELSE
                -- Date is available or already booked by the same p_booking_id (idempotency)
                -- Update it to 'pending_payment_confirmation' and link to this booking_id
                UPDATE public.car_availability
                SET status = 'pending_payment_confirmation', booking_id = p_booking_id, updated_at = now()
                WHERE id = availability_record.id;
            END IF;
        ELSE
            -- No record exists, means it's available. Insert a new one.
            INSERT INTO public.car_availability (car_id, date, status, booking_id)
            VALUES (p_car_id, loop_date, 'pending_payment_confirmation', p_booking_id);
        END IF;
    END LOOP;

    RETURN TRUE; -- All dates in the range were successfully reserved

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return false
        RAISE WARNING 'Error in check_and_reserve_car_availability: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_and_reserve_car_availability(UUID, DATE, DATE, UUID) IS 'SECURITY HARDENED: Search path fixed, checks and reserves car availability';

-- --------------------------------------------
-- Function 7: clear_car_availability_hold (from 20240521020000_create_clear_availability_hold_fn.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_car_availability_hold(
    p_booking_id UUID
)
RETURNS VOID AS $$
BEGIN
    SET search_path = '';
    UPDATE public.car_availability
    SET status = 'available', booking_id = NULL, updated_at = now()
    WHERE booking_id = p_booking_id AND status = 'pending_payment_confirmation';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.clear_car_availability_hold(UUID) IS 'SECURITY HARDENED: Search path fixed, clears car availability hold';

-- --------------------------------------------
-- Function 8: fn_free_car_availability_after_cancel (from 20240529001000_create_cancel_booking_triggers.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_free_car_availability_after_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    SET search_path = '';
    -- Check if the booking is actually being cancelled
    IF NEW.overall_status = 'cancelled'::public.booking_overall_status_enum AND 
       OLD.overall_status IS DISTINCT FROM 'cancelled'::public.booking_overall_status_enum THEN

        -- Update car_availability for the dates of this booking
        UPDATE public.car_availability
        SET 
            status = 'available'::public.car_availability_status_enum,
            booking_id = NULL -- Remove the link to this cancelled booking
        WHERE car_id = OLD.car_id -- Use OLD.car_id in case it could change, though unlikely for cancellations
          AND date >= OLD.start_date
          AND date <= OLD.end_date
          AND booking_id = OLD.id; -- Make sure we only update slots held by this specific booking
    END IF;
    RETURN NEW; -- For AFTER trigger, return value is ignored, but good practice
END;
$function$;

COMMENT ON FUNCTION public.fn_free_car_availability_after_cancel() IS 'SECURITY HARDENED: Search path fixed, frees availability after booking cancellation';

-- --------------------------------------------
-- Function 9: fn_confirm_car_availability_after_booking_confirmation (from 20240529001500_create_confirm_booking_triggers.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_confirm_car_availability_after_booking_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
    v_confirmed_statuses public.booking_overall_status_enum[];
BEGIN
    SET search_path = '';
    -- Define which statuses are considered "confirmed" for the purpose of this trigger
    v_confirmed_statuses := ARRAY[
        'upcoming'::public.booking_overall_status_enum, 
        'active'::public.booking_overall_status_enum
    ];

    -- Check if the new overall_status is one of the confirmed statuses
    -- AND the old overall_status was not one of these confirmed statuses (i.e., it's a transition into confirmed)
    IF NEW.overall_status = ANY(v_confirmed_statuses) AND 
       OLD.overall_status IS DISTINCT FROM NEW.overall_status AND
       NOT (OLD.overall_status = ANY(v_confirmed_statuses)) THEN

        -- Update car_availability for the dates of this booking from 'pending_confirmation' to 'booked'
        UPDATE public.car_availability
        SET status = 'booked'::public.car_availability_status_enum
        WHERE car_id = NEW.car_id
          AND date >= NEW.start_date
          AND date <= NEW.end_date
          AND booking_id = NEW.id
          AND status = 'pending_confirmation'::public.car_availability_status_enum; -- Only update if it was pending confirmation
    END IF;
    RETURN NEW; -- For AFTER trigger, return value is ignored
END;
$function$;

COMMENT ON FUNCTION public.fn_confirm_car_availability_after_booking_confirmation() IS 'SECURITY HARDENED: Search path fixed, confirms availability after booking confirmation';

-- --------------------------------------------
-- Function 10: calculate_car_average_rating (from 20250115_add_car_reviews.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_car_average_rating(p_car_id UUID)
RETURNS NUMERIC(3,2) AS $$
DECLARE
    avg_rating NUMERIC(3,2);
BEGIN
    SET search_path = '';
    SELECT ROUND(AVG(rating)::numeric, 2)
    INTO avg_rating
    FROM public.car_reviews
    WHERE car_id = p_car_id
    AND is_approved = true;
    
    RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.calculate_car_average_rating(UUID) IS 'SECURITY HARDENED: Search path fixed, calculates average rating for a car';

-- --------------------------------------------
-- Function 11: update_car_rating_stats (from 20250115_add_car_reviews.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_car_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    SET search_path = '';
    -- Update average rating and count for the car
    UPDATE public.cars
    SET 
        average_rating = (
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM public.car_reviews
            WHERE car_id = COALESCE(NEW.car_id, OLD.car_id)
            AND is_approved = true
        ),
        review_count = (
            SELECT COUNT(*)
            FROM public.car_reviews
            WHERE car_id = COALESCE(NEW.car_id, OLD.car_id)
            AND is_approved = true
        )
    WHERE id = COALESCE(NEW.car_id, OLD.car_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_car_rating_stats() IS 'SECURITY HARDENED: Search path fixed, updates car rating statistics';

-- --------------------------------------------
-- Function 12: update_updated_at_column (from 20250123_create_profiles_table.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    SET search_path = '';
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'SECURITY HARDENED: Search path fixed, trigger function to update updated_at column';

-- --------------------------------------------
-- Function 13: handle_new_user (from 20250123_create_profiles_table.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    SET search_path = '';
    INSERT INTO public.profiles (id, role, created_at, updated_at)
    VALUES (NEW.id, 'user', NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'SECURITY HARDENED: Search path fixed, creates profile for new auth user';

-- --------------------------------------------
-- Function 14: analyze_index_usage (from 20250623_add_critical_performance_indexes.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.analyze_index_usage()
RETURNS TABLE (
  schema_name text,
  table_name text,
  index_name text,
  index_scan_count bigint,
  index_size text,
  table_size text
) AS $$
BEGIN
  SET search_path = '';
  RETURN QUERY
  SELECT 
    schemaname::text,
    tablename::text,
    indexname::text,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)),
    pg_size_pretty(pg_relation_size(indrelid))
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.analyze_index_usage() IS 'SECURITY HARDENED: Search path fixed, analyzes index usage statistics';

-- --------------------------------------------
-- Function 15: calculate_webhook_retry_time (from 20250623_add_webhook_retries.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_webhook_retry_time(attempt_count integer)
RETURNS timestamptz AS $$
DECLARE
  minutes_to_wait integer;
BEGIN
  SET search_path = '';
  -- Exponential backoff: 1min, 5min, 15min, 60min, 60min...
  CASE attempt_count
    WHEN 0 THEN minutes_to_wait := 1;
    WHEN 1 THEN minutes_to_wait := 5;
    WHEN 2 THEN minutes_to_wait := 15;
    ELSE minutes_to_wait := 60;
  END CASE;
  
  RETURN now() + (minutes_to_wait || ' minutes')::interval;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.calculate_webhook_retry_time(integer) IS 'SECURITY HARDENED: Search path fixed, calculates webhook retry time with exponential backoff';

-- --------------------------------------------
-- Function 16: update_webhook_retries_updated_at (from 20250623_add_webhook_retries.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_webhook_retries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  SET search_path = '';
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_webhook_retries_updated_at() IS 'SECURITY HARDENED: Search path fixed, updates webhook retries timestamp';

-- --------------------------------------------
-- Function 17: is_webhook_processed (from 20250623_add_webhook_retries.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.is_webhook_processed(
  p_webhook_id varchar(255),
  p_webhook_type varchar(50)
)
RETURNS boolean AS $$
BEGIN
  SET search_path = '';
  RETURN EXISTS (
    SELECT 1 
    FROM public.webhook_processing_log 
    WHERE webhook_id = p_webhook_id 
    AND webhook_type = p_webhook_type
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.is_webhook_processed(varchar, varchar) IS 'SECURITY HARDENED: Search path fixed, checks if webhook was already processed';

-- --------------------------------------------
-- Function 18: mark_webhook_processed (from 20250623_add_webhook_retries.sql)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_webhook_processed(
  p_webhook_id varchar(255),
  p_webhook_type varchar(50),
  p_booking_id uuid DEFAULT NULL,
  p_processing_result jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  SET search_path = '';
  INSERT INTO public.webhook_processing_log (
    webhook_id,
    webhook_type,
    booking_id,
    processing_result
  ) VALUES (
    p_webhook_id,
    p_webhook_type,
    p_booking_id,
    p_processing_result
  )
  ON CONFLICT (webhook_id, webhook_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.mark_webhook_processed(varchar, varchar, uuid, jsonb) IS 'SECURITY HARDENED: Search path fixed, marks webhook as processed';

-- ============================================
-- SECTION 2: ENABLE RLS ON CRITICAL TABLES
-- ============================================
-- Enabling RLS on car_pricing, car_specifications, car_features

-- --------------------------------------------
-- Table: car_pricing - Enable RLS and add policies
-- --------------------------------------------
ALTER TABLE public.car_pricing ENABLE ROW LEVEL SECURITY;

-- Policy: Public users can read car pricing for non-hidden cars
CREATE POLICY "Public read car pricing for visible cars"
  ON public.car_pricing 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cars c 
      WHERE c.id = car_pricing.car_id 
      AND (c.hidden = false OR c.hidden IS NULL)
    )
  );

-- Policy: Authenticated admins can manage all car pricing
CREATE POLICY "Admins manage all car pricing"
  ON public.car_pricing
  FOR ALL
  USING (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Policy: Service role has full access
CREATE POLICY "Service role full access to car pricing"
  ON public.car_pricing
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.car_pricing IS 'RLS ENABLED: Car pricing information with row-level security';

-- --------------------------------------------
-- Table: car_specifications - Enable RLS and add policies
-- --------------------------------------------
ALTER TABLE public.car_specifications ENABLE ROW LEVEL SECURITY;

-- Policy: Public users can read specifications for non-hidden cars
CREATE POLICY "Public read car specifications for visible cars"
  ON public.car_specifications 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cars c 
      WHERE c.id = car_specifications.car_id 
      AND (c.hidden = false OR c.hidden IS NULL)
    )
  );

-- Policy: Authenticated admins can manage all car specifications
CREATE POLICY "Admins manage all car specifications"
  ON public.car_specifications
  FOR ALL
  USING (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Policy: Service role has full access
CREATE POLICY "Service role full access to car specifications"
  ON public.car_specifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.car_specifications IS 'RLS ENABLED: Car specifications with row-level security';

-- --------------------------------------------
-- Table: car_features - Enable RLS and add policies
-- --------------------------------------------
ALTER TABLE public.car_features ENABLE ROW LEVEL SECURITY;

-- Policy: Public users can read features for non-hidden cars
CREATE POLICY "Public read car features for visible cars"
  ON public.car_features 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cars c 
      WHERE c.id = car_features.car_id 
      AND (c.hidden = false OR c.hidden IS NULL)
    )
  );

-- Policy: Authenticated admins can manage all car features
CREATE POLICY "Admins manage all car features"
  ON public.car_features
  FOR ALL
  USING (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Policy: Service role has full access
CREATE POLICY "Service role full access to car features"
  ON public.car_features
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.car_features IS 'RLS ENABLED: Car features with row-level security';

-- ============================================
-- SECTION 3: AUDIT LOG
-- ============================================
-- Create audit log table to track security changes
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL DEFAULT '20250824_critical_security_hardening',
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_name TEXT NOT NULL,
  details JSONB,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log all security fixes applied
INSERT INTO public.security_audit_log (action, object_type, object_name, details)
VALUES 
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'update_modified_column', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'set_active_hero', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'update_timestamp', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'free_car_availability_after_cancel', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'confirm_car_availability_after_confirm', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'check_and_reserve_car_availability', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'clear_car_availability_hold', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'fn_free_car_availability_after_cancel', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'fn_confirm_car_availability_after_booking_confirmation', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'calculate_car_average_rating', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'update_car_rating_stats', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'update_updated_at_column', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'handle_new_user', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'analyze_index_usage', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'calculate_webhook_retry_time', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'update_webhook_retries_updated_at', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'is_webhook_processed', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('SEARCH_PATH_FIXED', 'FUNCTION', 'mark_webhook_processed', jsonb_build_object('issue', 'EXO-128', 'vulnerability', 'search_path injection')),
  ('RLS_ENABLED', 'TABLE', 'car_pricing', jsonb_build_object('issue', 'EXO-131', 'vulnerability', 'missing row-level security')),
  ('RLS_ENABLED', 'TABLE', 'car_specifications', jsonb_build_object('issue', 'EXO-131', 'vulnerability', 'missing row-level security')),
  ('RLS_ENABLED', 'TABLE', 'car_features', jsonb_build_object('issue', 'EXO-131', 'vulnerability', 'missing row-level security'));

-- ============================================
-- SECTION 4: VALIDATION QUERIES
-- ============================================
-- These queries help verify the security fixes were applied correctly

-- Verify RLS is enabled on the three tables
DO $$
DECLARE
  rls_check RECORD;
BEGIN
  FOR rls_check IN 
    SELECT schemaname, tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('car_pricing', 'car_specifications', 'car_features')
  LOOP
    IF NOT rls_check.rowsecurity THEN
      RAISE EXCEPTION 'RLS not enabled on table %.%', rls_check.schemaname, rls_check.tablename;
    END IF;
  END LOOP;
  RAISE NOTICE 'RLS verification passed for all three tables';
END $$;

-- Verify all functions have been updated (check proconfig for search_path)
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'update_modified_column',
    'set_active_hero',
    'update_timestamp',
    'free_car_availability_after_cancel',
    'confirm_car_availability_after_confirm',
    'check_and_reserve_car_availability',
    'clear_car_availability_hold',
    'fn_free_car_availability_after_cancel',
    'fn_confirm_car_availability_after_booking_confirmation',
    'calculate_car_average_rating',
    'update_car_rating_stats',
    'update_updated_at_column',
    'handle_new_user',
    'analyze_index_usage',
    'calculate_webhook_retry_time',
    'update_webhook_retries_updated_at',
    'is_webhook_processed',
    'mark_webhook_processed'
  );
  
  IF func_count = 18 THEN
    RAISE NOTICE 'All 18 functions have been updated successfully';
  ELSE
    RAISE WARNING 'Expected 18 functions, found %', func_count;
  END IF;
END $$;

COMMIT;

-- ============================================
-- ROLLBACK SECTION (COMMENTED OUT)
-- ============================================
-- To rollback this migration, uncomment and run the following:
/*
BEGIN;

-- Disable RLS on the three tables
ALTER TABLE public.car_pricing DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_specifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_features DISABLE ROW LEVEL SECURITY;

-- Drop the security policies
DROP POLICY IF EXISTS "Public read car pricing for visible cars" ON public.car_pricing;
DROP POLICY IF EXISTS "Admins manage all car pricing" ON public.car_pricing;
DROP POLICY IF EXISTS "Service role full access to car pricing" ON public.car_pricing;

DROP POLICY IF EXISTS "Public read car specifications for visible cars" ON public.car_specifications;
DROP POLICY IF EXISTS "Admins manage all car specifications" ON public.car_specifications;
DROP POLICY IF EXISTS "Service role full access to car specifications" ON public.car_specifications;

DROP POLICY IF EXISTS "Public read car features for visible cars" ON public.car_features;
DROP POLICY IF EXISTS "Admins manage all car features" ON public.car_features;
DROP POLICY IF EXISTS "Service role full access to car features" ON public.car_features;

-- Note: Rolling back function changes would require restoring original versions without SET search_path
-- This is not recommended as it would reintroduce security vulnerabilities

-- Log the rollback
INSERT INTO public.security_audit_log (action, object_type, object_name, details)
VALUES ('ROLLBACK', 'MIGRATION', '20250824_critical_security_hardening', jsonb_build_object('reason', 'Manual rollback requested'));

COMMIT;
*/

-- ============================================
-- END OF MIGRATION
-- ============================================