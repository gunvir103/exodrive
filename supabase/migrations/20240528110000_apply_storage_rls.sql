-- Ensure storage buckets exist (this is usually done via Supabase Studio or CLI commands, but can be idempotent)
-- Note: Supabase storage bucket creation via SQL is not standard.
-- This part is more of a placeholder to remind that buckets must exist.
-- You might need to create 'booking-media' and 'rental-agreements' via UI/CLI if not already done.

-- RLS for 'booking-media' bucket
-- Policy 1: Allow service_role full access
DROP POLICY IF EXISTS "Service role access for booking-media" ON storage.objects;
CREATE POLICY "Service role access for booking-media"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'booking-media')
  WITH CHECK (bucket_id = 'booking-media');

-- Policy 2: Allow authenticated users to upload to their booking's folder (e.g., booking-media/{booking_id}/*)
-- This requires a helper function to get booking_id from customer's auth.uid()
-- And assumes file path contains booking_id.
-- Example: customer uploads to booking-media/{booking_id}/photo_id_front.jpg
DROP POLICY IF EXISTS "Authenticated users can upload to their booking media folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their booking media folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'booking-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN ( -- Get first part of path as booking_id
      SELECT b.id::text FROM public.bookings b
      JOIN public.customers c ON b.customer_id = c.id
      WHERE c.user_id = auth.uid()
    )
    -- Optional: Restrict file types or size here in the CHECK if needed
    -- AND metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'application/pdf')
  );

-- Policy 3: Allow authenticated users to read from their booking's folder
DROP POLICY IF EXISTS "Authenticated users can read their booking media" ON storage.objects;
CREATE POLICY "Authenticated users can read their booking media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'booking-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT b.id::text FROM public.bookings b
      JOIN public.customers c ON b.customer_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Policy 4: Admins can manage all files in 'booking-media'
DROP POLICY IF EXISTS "Admins can manage all booking-media" ON storage.objects;
CREATE POLICY "Admins can manage all booking-media"
  ON storage.objects FOR ALL
  USING (bucket_id = 'booking-media' AND (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (bucket_id = 'booking-media' AND (auth.jwt() ->> 'role') = 'admin');


-- RLS for 'rental-agreements' bucket
-- Policy 1: Allow service_role full access
DROP POLICY IF EXISTS "Service role access for rental-agreements" ON storage.objects;
CREATE POLICY "Service role access for rental-agreements"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'rental-agreements')
  WITH CHECK (bucket_id = 'rental-agreements');

-- Policy 2: System (via service_role) or Admin can upload rental agreements
-- Covered by service_role policy above for uploads. Admins also covered below.

-- Policy 3: Authenticated users can read their specific rental agreement
-- Assumes filename or path includes booking_id or a secure token.
-- Let's assume path is rental-agreements/{booking_id}/agreement.pdf
DROP POLICY IF EXISTS "Authenticated users can read their rental agreement" ON storage.objects;
CREATE POLICY "Authenticated users can read their rental agreement"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'rental-agreements'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN ( -- Get first part of path as booking_id
      SELECT b.id::text FROM public.bookings b
      JOIN public.customers c ON b.customer_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Policy 4: Admins can manage all files in 'rental-agreements'
DROP POLICY IF EXISTS "Admins can manage all rental-agreements" ON storage.objects;
CREATE POLICY "Admins can manage all rental-agreements"
  ON storage.objects FOR ALL
  USING (bucket_id = 'rental-agreements' AND (auth.jwt() ->> 'role') = 'admin')
  WITH CHECK (bucket_id = 'rental-agreements' AND (auth.jwt() ->> 'role') = 'admin'); 