-- RLS for public.booking_secure_tokens
ALTER TABLE public.booking_secure_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_secure_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage secure tokens" ON public.booking_secure_tokens;
CREATE POLICY "Service role can manage secure tokens"
  ON public.booking_secure_tokens FOR ALL
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage secure tokens" ON public.booking_secure_tokens;
CREATE POLICY "Admins can manage secure tokens"
  ON public.booking_secure_tokens FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- RLS for public.booking_locations
ALTER TABLE public.booking_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_locations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage booking locations" ON public.booking_locations;
CREATE POLICY "Service role can manage booking locations"
  ON public.booking_locations FOR ALL
  TO service_role
  WITH CHECK (true);

-- Assuming customers are authenticated and their user_id is stored in customers.user_id
DROP POLICY IF EXISTS "Users can select their own booking locations" ON public.booking_locations;
CREATE POLICY "Users can select their own booking locations"
  ON public.booking_locations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.id = booking_locations.booking_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage booking locations" ON public.booking_locations;
CREATE POLICY "Admins can manage booking locations"
  ON public.booking_locations FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- RLS for public.booking_media
ALTER TABLE public.booking_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_media FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert booking media" ON public.booking_media;
CREATE POLICY "Service role can insert booking media"
  ON public.booking_media FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can insert media for their bookings" ON public.booking_media;
CREATE POLICY "Authenticated users can insert media for their bookings"
  ON public.booking_media FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.id = booking_media.booking_id AND c.user_id = auth.uid() -- Assuming customer has user_id
  ) AND booking_media.uploaded_by_type = 'customer' AND booking_media.uploaded_by_id = auth.uid());

DROP POLICY IF EXISTS "Users can select their own booking media" ON public.booking_media;
CREATE POLICY "Users can select their own booking media"
  ON public.booking_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.id = booking_media.booking_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage booking media" ON public.booking_media;
CREATE POLICY "Admins can manage booking media"
  ON public.booking_media FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- RLS for public.disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage disputes" ON public.disputes;
CREATE POLICY "Service role can manage disputes"
  ON public.disputes FOR ALL
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage disputes" ON public.disputes;
CREATE POLICY "Admins can manage disputes"
  ON public.disputes FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- RLS for public.dispute_evidence_items
ALTER TABLE public.dispute_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage dispute evidence items" ON public.dispute_evidence_items;
CREATE POLICY "Admins can manage dispute evidence items"
  ON public.dispute_evidence_items FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- RLS for public.booking_events
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role or Admin can insert booking events" ON public.booking_events;
CREATE POLICY "Service role or Admin can insert booking events"
  ON public.booking_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR (auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users can select events for their own bookings" ON public.booking_events;
CREATE POLICY "Users can select events for their own bookings"
  ON public.booking_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.id = booking_events.booking_id AND c.user_id IS NOT NULL AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can select all booking events" ON public.booking_events;
CREATE POLICY "Admins can select all booking events"
  ON public.booking_events FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete booking events if necessary" ON public.booking_events;
CREATE POLICY "Admins can delete booking events if necessary" -- Use with extreme caution
  ON public.booking_events FOR DELETE
  USING ((auth.jwt() ->> 'role') = 'admin');

-- RLS for public.paypal_invoices (as per databaseplan.md)
ALTER TABLE public.paypal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage paypal_invoices" ON public.paypal_invoices;
CREATE POLICY "Admin manage paypal_invoices"
  ON public.paypal_invoices FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users can view their paypal_invoices" ON public.paypal_invoices;
CREATE POLICY "Users can view their paypal_invoices"
  ON public.paypal_invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.id = paypal_invoices.booking_id AND c.user_id IS NOT NULL AND c.user_id = auth.uid()
  ));

-- Also ensure RLS is appropriately set for foundational tables like bookings, customers, car_availability if not already comprehensively done.
-- The following are examples and should be verified/adjusted against your existing RLS for these tables.

-- Example RLS for public.bookings (Review and adapt from your existing RLS or databaseplan.md RLS strategy section)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;

-- Public/anon can create bookings (as per booking.md)
DROP POLICY IF EXISTS "Allow public booking creation" ON public.bookings;
CREATE POLICY "Allow public booking creation"
  ON public.bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true); -- Further checks might be in functions or API layer

-- Owners can select their own bookings
DROP POLICY IF EXISTS "Users can select their own bookings" ON public.bookings;
CREATE POLICY "Users can select their own bookings"
  ON public.bookings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = bookings.customer_id AND c.user_id = auth.uid()
  ));
  
-- Admins can manage all bookings
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
CREATE POLICY "Admins can manage all bookings"
  ON public.bookings FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');


-- Example RLS for public.customers (Review and adapt)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own customer entry" ON public.customers;
CREATE POLICY "Users can manage their own customer entry"
  ON public.customers FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;
CREATE POLICY "Admins can manage all customers"
  ON public.customers FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- Example RLS for public.car_availability (Review and adapt)
ALTER TABLE public.car_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_availability FORCE ROW LEVEL SECURITY;

-- Public can read car_availability
DROP POLICY IF EXISTS "Public can read car_availability" ON public.car_availability;
CREATE POLICY "Public can read car_availability"
  ON public.car_availability FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role and Admin can manage car_availability
DROP POLICY IF EXISTS "Service role/Admin can manage car_availability" ON public.car_availability;
CREATE POLICY "Service role/Admin can manage car_availability"
  ON public.car_availability FOR ALL
  TO service_role -- and admin
  USING (auth.role() = 'service_role' OR (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (auth.role() = 'service_role' OR (auth.jwt() ->> 'role') = 'admin'); 