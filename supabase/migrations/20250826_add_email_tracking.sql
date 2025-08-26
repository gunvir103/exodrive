-- Add email status tracking to bookings table
-- This migration adds email-related columns to track email send status and history

-- Add email status tracking columns to bookings table
DO $$
BEGIN
  -- Add email status columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'email_confirmation_status') THEN
    ALTER TABLE public.bookings ADD COLUMN email_confirmation_status TEXT DEFAULT 'pending' CHECK (email_confirmation_status IN ('pending', 'sent', 'failed', 'retrying'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'email_confirmation_sent_at') THEN
    ALTER TABLE public.bookings ADD COLUMN email_confirmation_sent_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'email_confirmation_message_id') THEN
    ALTER TABLE public.bookings ADD COLUMN email_confirmation_message_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'email_payment_receipt_status') THEN
    ALTER TABLE public.bookings ADD COLUMN email_payment_receipt_status TEXT DEFAULT 'pending' CHECK (email_payment_receipt_status IN ('pending', 'sent', 'failed', 'retrying'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'email_payment_receipt_sent_at') THEN
    ALTER TABLE public.bookings ADD COLUMN email_payment_receipt_sent_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'email_payment_receipt_message_id') THEN
    ALTER TABLE public.bookings ADD COLUMN email_payment_receipt_message_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'email_last_failure_reason') THEN
    ALTER TABLE public.bookings ADD COLUMN email_last_failure_reason TEXT;
  END IF;
END$$;

-- Create email_events table for detailed email tracking
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('booking_confirmation', 'payment_receipt', 'booking_modification', 'booking_cancellation', 'contract', 'reminder')),
  recipient_email TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'complained')),
  message_id TEXT, -- Resend message ID
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- Add indexes for email_events
CREATE INDEX IF NOT EXISTS idx_email_events_booking_id ON public.email_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_events_email_type ON public.email_events(email_type);
CREATE INDEX IF NOT EXISTS idx_email_events_status ON public.email_events(status);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON public.email_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON public.email_events(created_at DESC);

-- Add updated_at trigger for email_events
CREATE TRIGGER update_email_events_timestamp
    BEFORE UPDATE ON public.email_events
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS on email_events
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Admin can manage all email events
DROP POLICY IF EXISTS "Admin manage email events" ON public.email_events;
CREATE POLICY "Admin manage email events"
  ON public.email_events
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- Add booking event types for email events
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_event_type_enum') THEN
    -- Add email event types to enum if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_sent' AND enumtypid = 'booking_event_type_enum'::regtype) THEN
      ALTER TYPE booking_event_type_enum ADD VALUE 'email_sent';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_failed' AND enumtypid = 'booking_event_type_enum'::regtype) THEN
      ALTER TYPE booking_event_type_enum ADD VALUE 'email_failed';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_delivered' AND enumtypid = 'booking_event_type_enum'::regtype) THEN
      ALTER TYPE booking_event_type_enum ADD VALUE 'email_delivered';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_bounced' AND enumtypid = 'booking_event_type_enum'::regtype) THEN
      ALTER TYPE booking_event_type_enum ADD VALUE 'email_bounced';
    END IF;
  END IF;
END$$;

-- Create function to update booking email status
CREATE OR REPLACE FUNCTION public.update_booking_email_status(
  p_booking_id UUID,
  p_email_type TEXT,
  p_status TEXT,
  p_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Update the appropriate email status column in bookings table
  IF p_email_type = 'booking_confirmation' THEN
    UPDATE public.bookings
    SET 
      email_confirmation_status = p_status,
      email_confirmation_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE email_confirmation_sent_at END,
      email_confirmation_message_id = COALESCE(p_message_id, email_confirmation_message_id),
      email_last_failure_reason = CASE WHEN p_status = 'failed' THEN p_error_message ELSE email_last_failure_reason END
    WHERE id = p_booking_id;
  ELSIF p_email_type = 'payment_receipt' THEN
    UPDATE public.bookings
    SET 
      email_payment_receipt_status = p_status,
      email_payment_receipt_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE email_payment_receipt_sent_at END,
      email_payment_receipt_message_id = COALESCE(p_message_id, email_payment_receipt_message_id),
      email_last_failure_reason = CASE WHEN p_status = 'failed' THEN p_error_message ELSE email_last_failure_reason END
    WHERE id = p_booking_id;
  END IF;
  
  -- Insert or update email_events record
  INSERT INTO public.email_events (
    booking_id,
    email_type,
    status,
    message_id,
    error_message,
    sent_at,
    failed_at,
    recipient_email
  ) VALUES (
    p_booking_id,
    p_email_type,
    p_status,
    p_message_id,
    p_error_message,
    CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'failed' THEN now() ELSE NULL END,
    (SELECT c.email FROM public.bookings b JOIN public.customers c ON b.customer_id = c.id WHERE b.id = p_booking_id)
  )
  ON CONFLICT (booking_id, email_type) 
  DO UPDATE SET
    status = EXCLUDED.status,
    message_id = COALESCE(EXCLUDED.message_id, email_events.message_id),
    error_message = EXCLUDED.error_message,
    retry_count = email_events.retry_count + CASE WHEN EXCLUDED.status = 'failed' THEN 1 ELSE 0 END,
    sent_at = EXCLUDED.sent_at,
    failed_at = EXCLUDED.failed_at,
    updated_at = now();
    
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to update email status for booking %: %', p_booking_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to prevent duplicate email events for same booking and type
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_booking_type_unique 
ON public.email_events(booking_id, email_type);

-- Create a view for easy email status monitoring
CREATE OR REPLACE VIEW public.booking_email_status AS
SELECT 
  b.id as booking_id,
  b.created_at as booking_created_at,
  c.email as customer_email,
  c.first_name,
  c.last_name,
  car.name as car_name,
  b.overall_status as booking_status,
  
  -- Email confirmation status
  b.email_confirmation_status,
  b.email_confirmation_sent_at,
  b.email_confirmation_message_id,
  
  -- Payment receipt status
  b.email_payment_receipt_status,
  b.email_payment_receipt_sent_at,
  b.email_payment_receipt_message_id,
  
  -- Last failure reason
  b.email_last_failure_reason,
  
  -- Email events summary
  (SELECT COUNT(*) FROM public.email_events ee WHERE ee.booking_id = b.id AND ee.status = 'failed') as failed_email_count,
  (SELECT COUNT(*) FROM public.email_events ee WHERE ee.booking_id = b.id AND ee.status = 'sent') as sent_email_count
  
FROM public.bookings b
JOIN public.customers c ON b.customer_id = c.id
JOIN public.cars car ON b.car_id = car.id
ORDER BY b.created_at DESC;

-- Grant permissions on the view
GRANT SELECT ON public.booking_email_status TO authenticated;

-- RLS policy for the view (admin only)
ALTER VIEW public.booking_email_status SET (security_invoker = true);

COMMENT ON TABLE public.email_events IS 'Tracks all email events for bookings including delivery status and failures';
COMMENT ON COLUMN public.bookings.email_confirmation_status IS 'Status of booking confirmation email';
COMMENT ON COLUMN public.bookings.email_payment_receipt_status IS 'Status of payment receipt email';
COMMENT ON FUNCTION public.update_booking_email_status IS 'Updates booking email status and logs email events';