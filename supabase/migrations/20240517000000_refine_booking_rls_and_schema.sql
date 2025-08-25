-- Migration: Refine RLS policies for booking-related tables and adjust schema

-- 1) Add user_id to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id)
-- 2) Modify car_availability.date column type
-- Note: This assumes the existing text can be cast to date. 
-- If not, manual data cleanup might be needed before running this in production.
ALTER TABLE public.car_availability
ALTER COLUMN date TYPE DATE USING date::DATE
-- 3) RLS for customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY
-- Drop permissive policy
DROP POLICY IF EXISTS "Public manage customers" ON public.customers
-- Authenticated users can insert their own customer record if one doesn't exist for their auth.uid
CREATE POLICY "Authenticated users can insert their own customer data" 
  ON public.customers FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.user_id = auth.uid()))
-- Authenticated users can select their own customer data
CREATE POLICY "Authenticated users can select their own customer data" 
  ON public.customers FOR SELECT 
  USING (auth.uid() = user_id)
-- Authenticated users can update their own customer data
CREATE POLICY "Authenticated users can update their own customer data" 
  ON public.customers FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id)
-- Admins can manage all customer data
CREATE POLICY "Admins can manage all customer data" 
  ON public.customers FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
-- 4) RLS for bookings table
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY
-- Already enabled, but good to ensure
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY
-- Drop previous admin policy to ensure it's the last one evaluated for admins or if signature changes
DROP POLICY IF EXISTS "Admin manage bookings" ON public.bookings
DROP POLICY IF EXISTS "Public insert bookings" ON public.bookings
-- Authenticated users or service role can insert bookings
-- We will link customer_id to auth.uid() in the API logic if user is authenticated
CREATE POLICY "Authenticated users can insert bookings" 
  ON public.bookings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role')
-- Users can select their own bookings (joining through customers table)
CREATE POLICY "Users can select their own bookings" 
  ON public.bookings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = bookings.customer_id AND c.user_id = auth.uid()))
-- Users can update their own booking to cancelled
CREATE POLICY "Users can cancel their own bookings" 
  ON public.bookings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = bookings.customer_id AND c.user_id = auth.uid()))
  WITH CHECK (status = 'cancelled')
-- Admins can manage all bookings
CREATE POLICY "Admins can manage all bookings" 
  ON public.bookings FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin')
-- WITH CHECK for insert/update by admin


-- 5) RLS for payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY
-- Already enabled
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY
DROP POLICY IF EXISTS "Admin manage payments" ON public.payments
-- Users can select payments linked to their bookings
CREATE POLICY "Users can select their own payments" 
  ON public.payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.id = payments.booking_id AND c.user_id = auth.uid()
  ))
-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments" 
  ON public.payments FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin')
-- 6) RLS for inbox_emails table
ALTER TABLE public.inbox_emails ENABLE ROW LEVEL SECURITY
ALTER TABLE public.inbox_emails FORCE ROW LEVEL SECURITY
-- Admins can manage all inbox_emails
CREATE POLICY "Admins can manage inbox_emails" 
  ON public.inbox_emails FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
-- 7) RLS for car_availability table
ALTER TABLE public.car_availability ENABLE ROW LEVEL SECURITY
ALTER TABLE public.car_availability FORCE ROW LEVEL SECURITY
-- Allow public/authenticated read access to car_availability
CREATE POLICY "Public can read car_availability" 
  ON public.car_availability FOR SELECT
  USING (true)
-- Admins can manage all car_availability
CREATE POLICY "Admins can manage car_availability" 
  ON public.car_availability FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin')