-- Create table for tracking processed webhook events to prevent replay attacks
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  webhook_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_event_id 
ON public.processed_webhook_events(event_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_booking_id 
ON public.processed_webhook_events(booking_id);

-- Create table for payment capture locking to prevent race conditions
CREATE TABLE IF NOT EXISTS public.payment_capture_locks (
  booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  locked_by VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for expired locks cleanup
CREATE INDEX IF NOT EXISTS idx_payment_locks_expires_at 
ON public.payment_capture_locks(expires_at);

-- Add comments for documentation
COMMENT ON TABLE public.processed_webhook_events IS 'Tracks processed webhook events to prevent replay attacks and ensure idempotency';
COMMENT ON COLUMN public.processed_webhook_events.event_id IS 'Unique identifier for the webhook event (combination of event_type, data_id, and timestamp)';
COMMENT ON COLUMN public.processed_webhook_events.webhook_timestamp IS 'Original timestamp from the webhook payload';

COMMENT ON TABLE public.payment_capture_locks IS 'Prevents concurrent payment capture attempts through distributed locking';
COMMENT ON COLUMN public.payment_capture_locks.locked_by IS 'Identifier of the process holding the lock (e.g., docuseal-webhook)';
COMMENT ON COLUMN public.payment_capture_locks.expires_at IS 'Automatic expiration time for the lock to prevent deadlocks';

-- Create function to acquire payment lock atomically
CREATE OR REPLACE FUNCTION public.acquire_payment_lock(
  p_booking_id UUID,
  p_locked_by VARCHAR(255),
  p_lock_duration_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_acquired BOOLEAN := FALSE;
BEGIN
  -- Try to insert a new lock
  INSERT INTO public.payment_capture_locks (
    booking_id,
    locked_by,
    expires_at
  )
  VALUES (
    p_booking_id,
    p_locked_by,
    NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (booking_id) DO UPDATE
  SET
    locked_at = NOW(),
    locked_by = p_locked_by,
    expires_at = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL
  WHERE
    payment_capture_locks.expires_at < NOW(); -- Only update if lock is expired
  
  -- Check if we acquired the lock
  SELECT (locked_by = p_locked_by) INTO v_lock_acquired
  FROM public.payment_capture_locks
  WHERE booking_id = p_booking_id;
  
  RETURN COALESCE(v_lock_acquired, FALSE);
END;
$$;

-- Create function to release payment lock
CREATE OR REPLACE FUNCTION public.release_payment_lock(
  p_booking_id UUID,
  p_locked_by VARCHAR(255)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_deleted INTEGER;
BEGIN
  DELETE FROM public.payment_capture_locks
  WHERE booking_id = p_booking_id
    AND locked_by = p_locked_by;
  
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  
  RETURN v_rows_deleted > 0;
END;
$$;

-- Create function to clean up expired locks (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_payment_locks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_deleted INTEGER;
BEGIN
  DELETE FROM public.payment_capture_locks
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  
  RETURN v_rows_deleted;
END;
$$;

-- Grant necessary permissions
GRANT ALL ON TABLE public.processed_webhook_events TO service_role;
GRANT ALL ON TABLE public.payment_capture_locks TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_payment_lock TO service_role;
GRANT EXECUTE ON FUNCTION public.release_payment_lock TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_payment_locks TO service_role;