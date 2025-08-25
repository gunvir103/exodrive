-- Migration: Fix and Standardize RLS Policies for Pricing Tables
-- Date: 2025-08-25
-- Author: Security Architecture Team
-- 
-- CRITICAL: This migration fixes broken admin RLS policies on car_pricing and car_specifications
-- that were using email-based checks with NULL app.admin_emails configuration.
-- All three pricing tables will be standardized to use the is_admin_user() function.

-- Set secure search path
SET search_path = public, extensions;

-- Start transaction for atomicity
BEGIN;

-- ============================================================================
-- STEP 0: Create is_admin_user() function (required for RLS policies)
-- ============================================================================
-- Drop existing function if it exists to ensure clean state
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Create the admin check function that all policies will use
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    );
$$;

-- Grant execute permission to public (authenticated and anon roles)
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO public;

-- Comment the function for documentation
COMMENT ON FUNCTION public.is_admin_user() IS 'Checks if the current authenticated user has admin role in the profiles table. Returns false for anonymous users.';

-- ============================================================================
-- STEP 1: Create security audit log table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz DEFAULT now() NOT NULL,
    action text NOT NULL,
    table_name text,
    policy_name text,
    details jsonb,
    performed_by uuid,
    migration_version text
);

-- Enable RLS on audit log (only service role can write)
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on audit log
DROP POLICY IF EXISTS "Service role can manage audit log" ON public.security_audit_log;

-- Create policy for service role access
CREATE POLICY "Service role can manage audit log"
    ON public.security_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STEP 2: Log migration start
-- ============================================================================
INSERT INTO public.security_audit_log (action, details, migration_version)
VALUES (
    'MIGRATION_START',
    jsonb_build_object(
        'description', 'Fixing and standardizing RLS policies for pricing tables',
        'affected_tables', ARRAY['car_pricing', 'car_specifications', 'car_additional_fees'],
        'critical_fixes', ARRAY[
            'Replacing broken email-based admin checks on car_pricing',
            'Replacing broken email-based admin checks on car_specifications',
            'Standardizing all tables to use is_admin_user() function'
        ]
    ),
    '20250825_fix_rls_policies_standardization'
);

-- ============================================================================
-- STEP 3: Fix car_pricing table policies
-- ============================================================================

-- Log current state before changes
INSERT INTO public.security_audit_log (action, table_name, details, migration_version)
SELECT 
    'POLICY_BACKUP',
    'car_pricing',
    jsonb_build_object(
        'policy_name', policyname,
        'definition', jsonb_build_object(
            'cmd', cmd,
            'qual', qual,
            'with_check', with_check,
            'roles', roles
        )
    ),
    '20250825_fix_rls_policies_standardization'
FROM pg_policies
WHERE tablename = 'car_pricing';

-- Drop the broken email-based admin policy
DROP POLICY IF EXISTS "Admins can manage car_pricing" ON public.car_pricing;

-- Log policy removal
INSERT INTO public.security_audit_log (action, table_name, policy_name, details, migration_version)
VALUES (
    'POLICY_DROPPED',
    'car_pricing',
    'Admins can manage car_pricing',
    jsonb_build_object('reason', 'Broken email-based check with NULL app.admin_emails'),
    '20250825_fix_rls_policies_standardization'
);

-- Create new standardized admin policy using is_admin_user()
CREATE POLICY "admin_full_access"
    ON public.car_pricing
    FOR ALL
    TO public
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- Log new policy creation
INSERT INTO public.security_audit_log (action, table_name, policy_name, details, migration_version)
VALUES (
    'POLICY_CREATED',
    'car_pricing',
    'admin_full_access',
    jsonb_build_object(
        'type', 'Admin full access via is_admin_user()',
        'security_improvement', 'Uses centralized admin check function instead of broken email-based check'
    ),
    '20250825_fix_rls_policies_standardization'
);

-- Rename existing public read policy for consistency
DROP POLICY IF EXISTS "Public can read pricing" ON public.car_pricing;
CREATE POLICY "public_read_access"
    ON public.car_pricing
    FOR SELECT
    TO public
    USING (true);

-- Ensure service role policy exists with consistent naming
DROP POLICY IF EXISTS "Service role full access" ON public.car_pricing;
CREATE POLICY "service_role_full_access"
    ON public.car_pricing
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STEP 4: Fix car_specifications table policies
-- ============================================================================

-- Log current state before changes
INSERT INTO public.security_audit_log (action, table_name, details, migration_version)
SELECT 
    'POLICY_BACKUP',
    'car_specifications',
    jsonb_build_object(
        'policy_name', policyname,
        'definition', jsonb_build_object(
            'cmd', cmd,
            'qual', qual,
            'with_check', with_check,
            'roles', roles
        )
    ),
    '20250825_fix_rls_policies_standardization'
FROM pg_policies
WHERE tablename = 'car_specifications';

-- Drop the broken email-based admin policy
DROP POLICY IF EXISTS "Admins can manage car_specifications" ON public.car_specifications;

-- Log policy removal
INSERT INTO public.security_audit_log (action, table_name, policy_name, details, migration_version)
VALUES (
    'POLICY_DROPPED',
    'car_specifications',
    'Admins can manage car_specifications',
    jsonb_build_object('reason', 'Broken email-based check with NULL app.admin_emails'),
    '20250825_fix_rls_policies_standardization'
);

-- Create new standardized admin policy using is_admin_user()
CREATE POLICY "admin_full_access"
    ON public.car_specifications
    FOR ALL
    TO public
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- Log new policy creation
INSERT INTO public.security_audit_log (action, table_name, policy_name, details, migration_version)
VALUES (
    'POLICY_CREATED',
    'car_specifications',
    'admin_full_access',
    jsonb_build_object(
        'type', 'Admin full access via is_admin_user()',
        'security_improvement', 'Uses centralized admin check function instead of broken email-based check'
    ),
    '20250825_fix_rls_policies_standardization'
);

-- Rename existing public read policy for consistency
DROP POLICY IF EXISTS "Public can read specifications" ON public.car_specifications;
CREATE POLICY "public_read_access"
    ON public.car_specifications
    FOR SELECT
    TO public
    USING (true);

-- Ensure service role policy exists with consistent naming
DROP POLICY IF EXISTS "Service role full access" ON public.car_specifications;
CREATE POLICY "service_role_full_access"
    ON public.car_specifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- STEP 5: Standardize car_additional_fees table policies (already correct but rename for consistency)
-- ============================================================================

-- Log current state before changes
INSERT INTO public.security_audit_log (action, table_name, details, migration_version)
SELECT 
    'POLICY_BACKUP',
    'car_additional_fees',
    jsonb_build_object(
        'policy_name', policyname,
        'definition', jsonb_build_object(
            'cmd', cmd,
            'qual', qual,
            'with_check', with_check,
            'roles', roles
        )
    ),
    '20250825_fix_rls_policies_standardization'
FROM pg_policies
WHERE tablename = 'car_additional_fees';

-- Drop existing policies to recreate with consistent naming
DROP POLICY IF EXISTS "Admins can manage car additional fees" ON public.car_additional_fees;
DROP POLICY IF EXISTS "Public can view car additional fees" ON public.car_additional_fees;
DROP POLICY IF EXISTS "Service role full access" ON public.car_additional_fees;

-- Create standardized policies with consistent naming
CREATE POLICY "admin_full_access"
    ON public.car_additional_fees
    FOR ALL
    TO public
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "public_read_access"
    ON public.car_additional_fees
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "service_role_full_access"
    ON public.car_additional_fees
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Log policy standardization
INSERT INTO public.security_audit_log (action, table_name, details, migration_version)
VALUES (
    'POLICIES_STANDARDIZED',
    'car_additional_fees',
    jsonb_build_object(
        'note', 'Policies renamed for consistency across all pricing tables',
        'already_secure', true
    ),
    '20250825_fix_rls_policies_standardization'
);

-- ============================================================================
-- STEP 6: Create verification function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_pricing_table_policies()
RETURNS TABLE (
    table_name text,
    has_admin_policy boolean,
    has_public_read boolean,
    has_service_role boolean,
    uses_is_admin_user boolean,
    is_secure boolean
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH policy_check AS (
        SELECT 
            tablename,
            policyname,
            cmd,
            qual,
            roles
        FROM pg_policies
        WHERE tablename IN ('car_pricing', 'car_specifications', 'car_additional_fees')
    )
    SELECT 
        t.table_name::text,
        EXISTS(SELECT 1 FROM policy_check WHERE tablename = t.table_name AND policyname = 'admin_full_access') as has_admin_policy,
        EXISTS(SELECT 1 FROM policy_check WHERE tablename = t.table_name AND policyname = 'public_read_access') as has_public_read,
        EXISTS(SELECT 1 FROM policy_check WHERE tablename = t.table_name AND policyname = 'service_role_full_access') as has_service_role,
        EXISTS(SELECT 1 FROM policy_check WHERE tablename = t.table_name AND qual LIKE '%is_admin_user()%') as uses_is_admin_user,
        NOT EXISTS(SELECT 1 FROM policy_check WHERE tablename = t.table_name AND qual LIKE '%app.admin_emails%') as is_secure
    FROM (
        VALUES 
            ('car_pricing'),
            ('car_specifications'),
            ('car_additional_fees')
    ) t(table_name);
$$;

-- ============================================================================
-- STEP 7: Run verification and log results
-- ============================================================================
INSERT INTO public.security_audit_log (action, details, migration_version)
SELECT 
    'VERIFICATION_COMPLETE',
    jsonb_build_object(
        'verification_results', jsonb_agg(
            jsonb_build_object(
                'table', table_name,
                'admin_policy', has_admin_policy,
                'public_read', has_public_read,
                'service_role', has_service_role,
                'uses_admin_function', uses_is_admin_user,
                'secure', is_secure
            )
        ),
        'all_secure', bool_and(is_secure),
        'all_standardized', bool_and(has_admin_policy AND has_public_read AND has_service_role AND uses_is_admin_user)
    ),
    '20250825_fix_rls_policies_standardization'
FROM public.verify_pricing_table_policies();

-- ============================================================================
-- STEP 8: Create test functions for policy verification
-- ============================================================================

-- Test function to verify public read access
CREATE OR REPLACE FUNCTION public.test_pricing_public_read_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb := '{}';
    can_read_pricing boolean;
    can_read_specs boolean;
    can_read_fees boolean;
BEGIN
    -- Test as anonymous user (no auth context)
    SET LOCAL role = anon;
    
    -- Test SELECT access
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.car_pricing LIMIT 1)' INTO can_read_pricing;
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.car_specifications LIMIT 1)' INTO can_read_specs;
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.car_additional_fees LIMIT 1)' INTO can_read_fees;
    
    result := jsonb_build_object(
        'test', 'public_read_access',
        'car_pricing_readable', can_read_pricing,
        'car_specifications_readable', can_read_specs,
        'car_additional_fees_readable', can_read_fees,
        'all_readable', can_read_pricing AND can_read_specs AND can_read_fees
    );
    
    RESET role;
    RETURN result;
END;
$$;

-- Test function to verify admin write access (requires actual admin user context)
CREATE OR REPLACE FUNCTION public.test_pricing_admin_access(test_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb := '{}';
    is_admin boolean;
    test_id uuid;
BEGIN
    -- Check if test user is admin
    IF test_user_id IS NOT NULL THEN
        SELECT (role = 'admin') INTO is_admin 
        FROM public.profiles 
        WHERE id = test_user_id;
        
        IF is_admin IS NULL THEN
            RETURN jsonb_build_object(
                'error', 'User not found',
                'user_id', test_user_id
            );
        END IF;
    ELSE
        is_admin := false;
    END IF;
    
    result := jsonb_build_object(
        'test', 'admin_access',
        'user_id', test_user_id,
        'is_admin', is_admin,
        'expected_access', CASE WHEN is_admin THEN 'full' ELSE 'read-only' END,
        'note', 'Full test requires actual auth context with admin user'
    );
    
    RETURN result;
END;
$$;

-- ============================================================================
-- STEP 9: Final summary and recommendations
-- ============================================================================
INSERT INTO public.security_audit_log (action, details, migration_version)
VALUES (
    'MIGRATION_COMPLETE',
    jsonb_build_object(
        'summary', 'Successfully fixed and standardized RLS policies for all pricing tables',
        'security_improvements', ARRAY[
            'Removed broken email-based admin checks',
            'Implemented consistent is_admin_user() function checks',
            'Standardized policy naming across all tables',
            'Added comprehensive audit logging',
            'Created verification and test functions'
        ],
        'recommendations', ARRAY[
            'Run verify_pricing_table_policies() regularly to ensure policy integrity',
            'Test with actual admin and non-admin users in staging environment',
            'Monitor security_audit_log for any policy changes',
            'Consider adding row-level audit triggers for data changes'
        ],
        'backward_compatibility', 'Maintained - public read and admin access patterns unchanged'
    ),
    '20250825_fix_rls_policies_standardization'
);

-- Commit the transaction
COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (Run these manually after migration)
-- ============================================================================

-- 1. Verify all policies are correctly set
SELECT * FROM public.verify_pricing_table_policies();

-- 2. Check that no email-based policies remain
SELECT COUNT(*) as broken_policies_count
FROM pg_policies
WHERE tablename IN ('car_pricing', 'car_specifications', 'car_additional_fees')
AND qual LIKE '%app.admin_emails%';

-- 3. Test public read access
SELECT public.test_pricing_public_read_access();

-- 4. View audit log for this migration
SELECT * FROM public.security_audit_log 
WHERE migration_version = '20250825_fix_rls_policies_standardization'
ORDER BY timestamp;

-- ============================================================================
-- ROLLBACK SCRIPT (Save this separately - use only if needed)
-- ============================================================================
/*
-- EMERGENCY ROLLBACK - Use with caution
BEGIN;

-- Restore car_pricing policies to original state (broken but maintains compatibility)
DROP POLICY IF EXISTS "admin_full_access" ON public.car_pricing;
DROP POLICY IF EXISTS "public_read_access" ON public.car_pricing;
DROP POLICY IF EXISTS "service_role_full_access" ON public.car_pricing;

CREATE POLICY "Admins can manage car_pricing"
    ON public.car_pricing
    FOR ALL
    TO public
    USING ((auth.role() = 'authenticated'::text) AND ((auth.jwt() ->> 'email'::text) IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'::text, true), ','::text)))))
    WITH CHECK ((auth.role() = 'authenticated'::text) AND ((auth.jwt() ->> 'email'::text) IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'::text, true), ','::text)))));

CREATE POLICY "Public can read pricing"
    ON public.car_pricing
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Service role full access"
    ON public.car_pricing
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Restore car_specifications policies to original state
DROP POLICY IF EXISTS "admin_full_access" ON public.car_specifications;
DROP POLICY IF EXISTS "public_read_access" ON public.car_specifications;
DROP POLICY IF EXISTS "service_role_full_access" ON public.car_specifications;

CREATE POLICY "Admins can manage car_specifications"
    ON public.car_specifications
    FOR ALL
    TO public
    USING ((auth.role() = 'authenticated'::text) AND ((auth.jwt() ->> 'email'::text) IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'::text, true), ','::text)))))
    WITH CHECK ((auth.role() = 'authenticated'::text) AND ((auth.jwt() ->> 'email'::text) IN (SELECT unnest(string_to_array(current_setting('app.admin_emails'::text, true), ','::text)))));

CREATE POLICY "Public can read specifications"
    ON public.car_specifications
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Service role full access"
    ON public.car_specifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Restore car_additional_fees policies to original state
DROP POLICY IF EXISTS "admin_full_access" ON public.car_additional_fees;
DROP POLICY IF EXISTS "public_read_access" ON public.car_additional_fees;
DROP POLICY IF EXISTS "service_role_full_access" ON public.car_additional_fees;

CREATE POLICY "Admins can manage car additional fees"
    ON public.car_additional_fees
    FOR ALL
    TO public
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

CREATE POLICY "Public can view car additional fees"
    ON public.car_additional_fees
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Service role full access"
    ON public.car_additional_fees
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Log rollback
INSERT INTO public.security_audit_log (action, details, migration_version)
VALUES (
    'MIGRATION_ROLLED_BACK',
    jsonb_build_object(
        'reason', 'Manual rollback initiated',
        'timestamp', now(),
        'warning', 'Policies restored to original state - email-based checks still broken'
    ),
    '20250825_fix_rls_policies_standardization_ROLLBACK'
);

COMMIT;
*/