-- Create public.booking_secure_tokens
CREATE TABLE IF NOT EXISTS public.booking_secure_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE, -- Will be FK to public.bookings(id) later
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_secure_tokens_token ON public.booking_secure_tokens(token);
CREATE INDEX IF NOT EXISTS idx_booking_secure_tokens_booking_id ON public.booking_secure_tokens(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_secure_tokens_expires_at ON public.booking_secure_tokens(expires_at);

-- Create public.booking_events (Timeline)
CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL, -- Will be FK to public.bookings(id) later
  event_type booking_event_type_enum NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type actor_type_enum,
  actor_id TEXT,
  actor_name TEXT,
  details JSONB,
  summary_text TEXT, -- A human-readable summary of the event
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id_timestamp ON public.booking_events(booking_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_type ON public.booking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_actor_type ON public.booking_events(actor_type); 