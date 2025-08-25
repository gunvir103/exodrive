-- Create webhook retry status enum
CREATE TYPE IF NOT EXISTS webhook_retry_status_enum AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'dead_letter');

-- Create webhook retries table
CREATE TABLE IF NOT EXISTS public.webhook_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id varchar(255) NOT NULL, -- External webhook ID from provider (e.g., PayPal event ID)
  webhook_type varchar(50) NOT NULL, -- Type of webhook (paypal, resend, docuseal)
  payload jsonb NOT NULL, -- Full webhook payload
  headers jsonb, -- Original webhook headers
  endpoint_url text NOT NULL, -- URL to retry the webhook to
  attempt_count integer DEFAULT 0 NOT NULL,
  max_attempts integer DEFAULT 5 NOT NULL,
  next_retry_at timestamptz,
  last_attempt_at timestamptz,
  status webhook_retry_status_enum DEFAULT 'pending' NOT NULL,
  error_message text,
  error_details jsonb,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  succeeded_at timestamptz,
  failed_permanently_at timestamptz,
  CONSTRAINT webhook_retries_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT webhook_retries_max_attempts_check CHECK (max_attempts > 0 AND max_attempts <= 10)
);

-- Create indexes for efficient querying
CREATE INDEX idx_webhook_retries_status ON public.webhook_retries(status);
CREATE INDEX idx_webhook_retries_next_retry_at ON public.webhook_retries(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_webhook_retries_webhook_id ON public.webhook_retries(webhook_id);
CREATE INDEX idx_webhook_retries_booking_id ON public.webhook_retries(booking_id);
CREATE INDEX idx_webhook_retries_created_at ON public.webhook_retries(created_at);
CREATE INDEX idx_webhook_retries_webhook_type ON public.webhook_retries(webhook_type);

-- Create composite index for finding retries to process
CREATE INDEX idx_webhook_retries_pending_processing ON public.webhook_retries(status, next_retry_at) 
WHERE status IN ('pending', 'processing') AND next_retry_at IS NOT NULL;

-- Add comment on table
COMMENT ON TABLE public.webhook_retries IS 'Stores failed webhooks for retry with exponential backoff';

-- Add comments on columns
COMMENT ON COLUMN public.webhook_retries.webhook_id IS 'External webhook ID from provider (e.g., PayPal event ID)';
COMMENT ON COLUMN public.webhook_retries.webhook_type IS 'Type of webhook (paypal, resend, docuseal)';
COMMENT ON COLUMN public.webhook_retries.payload IS 'Full webhook payload to be retried';
COMMENT ON COLUMN public.webhook_retries.headers IS 'Original webhook headers for signature verification';
COMMENT ON COLUMN public.webhook_retries.attempt_count IS 'Number of retry attempts made';
COMMENT ON COLUMN public.webhook_retries.next_retry_at IS 'When to attempt the next retry';
COMMENT ON COLUMN public.webhook_retries.status IS 'Current status of the webhook retry';
COMMENT ON COLUMN public.webhook_retries.failed_permanently_at IS 'When the webhook was moved to dead letter queue';

-- Create webhook processing log table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_processing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id varchar(255) NOT NULL,
  webhook_type varchar(50) NOT NULL,
  processed_at timestamptz DEFAULT now() NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  processing_result jsonb,
  CONSTRAINT webhook_processing_log_unique_webhook UNIQUE (webhook_id, webhook_type)
);

-- Create index for fast lookup
CREATE INDEX idx_webhook_processing_log_webhook ON public.webhook_processing_log(webhook_id, webhook_type);
CREATE INDEX idx_webhook_processing_log_booking_id ON public.webhook_processing_log(booking_id);

-- Add comment on table
COMMENT ON TABLE public.webhook_processing_log IS 'Tracks successfully processed webhooks for idempotency';

-- Create function to calculate next retry time with exponential backoff
CREATE OR REPLACE FUNCTION calculate_webhook_retry_time(attempt_count integer)
RETURNS timestamptz AS $$
DECLARE
  minutes_to_wait integer;
BEGIN
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_retries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_webhook_retries_timestamp
BEFORE UPDATE ON public.webhook_retries
FOR EACH ROW EXECUTE FUNCTION update_webhook_retries_updated_at();

-- Create RLS policies
ALTER TABLE public.webhook_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_processing_log ENABLE ROW LEVEL SECURITY;

-- Admin users can view and manage all webhook retries
CREATE POLICY webhook_retries_admin_all ON public.webhook_retries
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email IN (
      SELECT unnest(string_to_array(
        COALESCE(current_setting('app.admin_emails', true), ''),
        ','
      ))
    )
  ));

-- Admin users can view all webhook processing logs
CREATE POLICY webhook_processing_log_admin_all ON public.webhook_processing_log
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email IN (
      SELECT unnest(string_to_array(
        COALESCE(current_setting('app.admin_emails', true), ''),
        ','
      ))
    )
  ));

-- Service role has full access
CREATE POLICY webhook_retries_service_role ON public.webhook_retries
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY webhook_processing_log_service_role ON public.webhook_processing_log
  FOR ALL
  TO service_role
  USING (true);

-- Create webhook monitoring view
CREATE OR REPLACE VIEW webhook_retry_metrics AS
SELECT 
  webhook_type,
  status,
  COUNT(*) as count,
  AVG(attempt_count) as avg_attempts,
  MAX(attempt_count) as max_attempts,
  MIN(created_at) as oldest_retry,
  MAX(created_at) as newest_retry
FROM public.webhook_retries
GROUP BY webhook_type, status;

-- Grant permissions on the view
GRANT SELECT ON webhook_retry_metrics TO authenticated;

-- Create dead letter queue view
CREATE OR REPLACE VIEW webhook_dead_letter_queue AS
SELECT 
  id,
  webhook_id,
  webhook_type,
  booking_id,
  payload,
  attempt_count,
  error_message,
  created_at,
  failed_permanently_at
FROM public.webhook_retries
WHERE status = 'dead_letter'
ORDER BY failed_permanently_at DESC;

-- Grant permissions on the view
GRANT SELECT ON webhook_dead_letter_queue TO authenticated;

-- Add function to check if webhook was already processed (for idempotency)
CREATE OR REPLACE FUNCTION is_webhook_processed(
  p_webhook_id varchar(255),
  p_webhook_type varchar(50)
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.webhook_processing_log 
    WHERE webhook_id = p_webhook_id 
    AND webhook_type = p_webhook_type
  );
END;
$$ LANGUAGE plpgsql;

-- Add function to mark webhook as processed
CREATE OR REPLACE FUNCTION mark_webhook_processed(
  p_webhook_id varchar(255),
  p_webhook_type varchar(50),
  p_booking_id uuid DEFAULT NULL,
  p_processing_result jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
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