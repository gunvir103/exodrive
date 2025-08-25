-- Migration: Adjustments for guest customers and related RLS policies

-- Statement: Modify customers.user_id to be nullable and not unique
-- Reason: To support guest customers who don't have an auth.user_id,
-- and to allow an admin/service_role to potentially create multiple customer
-- entries that might not be linked to any specific auth.user.
ALTER TABLE public.customers
ALTER COLUMN user_id DROP NOT NULL,
DROP CONSTRAINT IF EXISTS customers_user_id_key
-- Removes the UNIQUE constraint if it was named this (common default)
-- If the unique constraint has a different name, you might need to find it and drop it manually:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.customers'::regclass AND contype = 'u';
-- And then: ALTER TABLE public.customers DROP CONSTRAINT your_constraint_name;

-- Statement: RLS for customers table adjustments
-- Reason: To ensure service_role (backend API) can create customer records for guests,
-- and to refine existing policies for clarity with nullable user_id.

-- Drop existing policies that might conflict or need reordering
DROP POLICY IF EXISTS "Authenticated users can insert their own customer data" ON public.customers
DROP POLICY IF EXISTS "Authenticated users can select their own customer data" ON public.customers
DROP POLICY IF EXISTS "Authenticated users can update their own customer data" ON public.customers
DROP POLICY IF EXISTS "Admins can manage all customer data" ON public.customers
-- Policy: Allow service_role to insert customer records
-- For guest checkouts made by the backend.
CREATE POLICY "Service role can insert customer data"
  ON public.customers FOR INSERT
  TO service_role
  WITH CHECK (true)
-- Policy: Authenticated users can insert their OWN customer record
-- This is for a scenario where a logged-in user might be creating their customer profile.
-- Ensures user_id matches auth.uid() and one doesn't already exist for that user_id.
CREATE POLICY "Authenticated users can insert their own linked customer data"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.user_id = auth.uid()))
-- Policy: Authenticated users can select their own customer data if user_id is linked
CREATE POLICY "Authenticated users can select their own linked customer data"
  ON public.customers FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid())
-- Policy: Authenticated users can update their own customer data if user_id is linked
CREATE POLICY "Authenticated users can update their own linked customer data"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid())
-- Policy: Admins can manage all customer data (covers select, insert, update, delete)
CREATE POLICY "Admins can manage all customer data"
  ON public.customers FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin')
-- Statement: RLS for bookings table adjustments
-- Reason: Explicitly allow service_role (backend API) to insert bookings for guests.
-- Existing policies for 'authenticated' users and admins are generally okay but
-- we want to be explicit for service_role which handles guest bookings.

-- Drop existing policies that might conflict or need reordering
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON public.bookings
DROP POLICY IF EXISTS "Users can select their own bookings" ON public.bookings
DROP POLICY IF EXISTS "Users can cancel their own bookings" ON public.bookings
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings
-- Policy: Allow service_role to insert bookings
-- This will be used by the backend API for guest bookings.
CREATE POLICY "Service role can insert bookings"
  ON public.bookings FOR INSERT
  TO service_role
  WITH CHECK (true)
-- Policy: Authenticated users can insert bookings
-- For scenarios where a logged-in user (e.g., an admin) makes a booking.
-- The API would be responsible for linking the correct customer_id.
CREATE POLICY "Authenticated users can insert bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (true)
-- Further checks on customer_id linkage can be done in API or via `EXISTS` if needed

-- Policy: Users can select their own bookings if their customer record is linked via user_id
CREATE POLICY "Users can select their own bookings via linked customer"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = bookings.customer_id AND c.user_id IS NOT NULL AND c.user_id = auth.uid()
  ))
-- Policy: Users can update (cancel) their own bookings if their customer record is linked
CREATE POLICY "Users can cancel their own bookings via linked customer"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = bookings.customer_id AND c.user_id IS NOT NULL AND c.user_id = auth.uid()
  ))
  WITH CHECK (status = 'cancelled')
-- Policy: Admins can manage all bookings
CREATE POLICY "Admins can manage all bookings"
  ON public.bookings FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin')
-- Ensure RLS is enforced
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY