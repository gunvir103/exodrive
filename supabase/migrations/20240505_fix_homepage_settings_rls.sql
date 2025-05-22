-- Temporarily modify homepage_settings table for easier testing

-- Option 1: Disable RLS completely on the table (simplest for testing)
ALTER TABLE public.homepage_settings DISABLE ROW LEVEL SECURITY;

-- Option 2: Or create a more permissive policy that allows all authenticated users
-- Comment these out if using Option 1
-- DROP POLICY IF EXISTS "Admin users can manage homepage settings" ON public.homepage_settings;
-- CREATE POLICY "Any authenticated user can manage homepage settings" 
-- ON public.homepage_settings 
-- FOR ALL 
-- USING (auth.role() = 'authenticated') 
-- WITH CHECK (auth.role() = 'authenticated');

-- For production, you would revert to the proper admin-only policy:
-- CREATE POLICY "Admin users can manage homepage settings" 
-- ON public.homepage_settings 
-- FOR ALL 
-- USING (
--   auth.role() = 'authenticated' 
--   AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ',')) as email)
-- ) 
-- WITH CHECK (
--   auth.role() = 'authenticated' 
--   AND auth.jwt() ->> 'email' IN (SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ',')) as email)
-- ); 