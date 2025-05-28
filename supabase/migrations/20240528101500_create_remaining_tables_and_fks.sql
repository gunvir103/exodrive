-- Create public.booking_locations
CREATE TABLE IF NOT EXISTS public.booking_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL, -- FK to public.bookings(id)
  type booking_location_type_enum NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  formatted_address TEXT,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (booking_id, type)
);

CREATE INDEX IF NOT EXISTS idx_booking_locations_booking_id ON public.booking_locations(booking_id);

-- Create public.booking_media
CREATE TABLE IF NOT EXISTS public.booking_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL, -- FK to public.bookings(id)
  stage booking_media_stage_enum NOT NULL,
  file_path TEXT NOT NULL,
  storage_bucket_id TEXT NOT NULL DEFAULT 'booking-media',
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  type booking_media_type_enum NOT NULL,
  description TEXT,
  uploaded_by_type booking_media_uploader_enum NOT NULL,
  uploaded_by_id UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_media_booking_id ON public.booking_media(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_media_stage ON public.booking_media(stage);
CREATE INDEX IF NOT EXISTS idx_booking_media_type ON public.booking_media(type);

-- Create public.disputes
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE, -- FK to public.bookings(id)
  payment_id UUID, -- FK to public.payments(id)
  dispute_provider TEXT NOT NULL DEFAULT 'PayPal',
  provider_dispute_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- Consider an enum here later if states are well-defined
  reason TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  opened_at TIMESTAMPTZ NOT NULL,
  evidence_due_date TIMESTAMPTZ,
  evidence_submitted_at TIMESTAMPTZ,
  initial_invoice_attachments_info TEXT,
  provider_communication JSONB,
  resolved_at TIMESTAMPTZ,
  resolution_outcome TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_booking_id ON public.disputes(booking_id);
CREATE INDEX IF NOT EXISTS idx_disputes_provider_dispute_id ON public.disputes(provider_dispute_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);

-- Create public.dispute_evidence_items
CREATE TABLE IF NOT EXISTS public.dispute_evidence_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID NOT NULL, -- FK to public.disputes(id)
  booking_media_id UUID NOT NULL, -- FK to public.booking_media(id)
  description TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (dispute_id, booking_media_id)
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_items_dispute_id ON public.dispute_evidence_items(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_items_booking_media_id ON public.dispute_evidence_items(booking_media_id);


-- Add Foreign Key Constraints (deferred from previous migrations)

-- FK for public.booking_secure_tokens.booking_id -> public.bookings.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_secure_tokens_booking_id' AND conrelid = 'public.booking_secure_tokens'::regclass) THEN
    ALTER TABLE public.booking_secure_tokens
      ADD CONSTRAINT fk_booking_secure_tokens_booking_id
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK fk_booking_secure_tokens_booking_id to public.booking_secure_tokens';
  ELSE
    RAISE NOTICE 'FK fk_booking_secure_tokens_booking_id on public.booking_secure_tokens already exists, skipping.';
  END IF;
END $$;

-- FK for public.bookings.secure_token_id -> public.booking_secure_tokens.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_secure_token' AND conrelid = 'public.bookings'::regclass) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT fk_booking_secure_token
      FOREIGN KEY (secure_token_id) REFERENCES public.booking_secure_tokens(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added FK fk_booking_secure_token to public.bookings';
  ELSE
    RAISE NOTICE 'FK fk_booking_secure_token on public.bookings already exists, skipping.';
  END IF;
END $$;

-- FK for public.booking_events.booking_id -> public.bookings.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_events_booking_id' AND conrelid = 'public.booking_events'::regclass) THEN
    ALTER TABLE public.booking_events
      ADD CONSTRAINT fk_booking_events_booking_id
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK fk_booking_events_booking_id to public.booking_events';
  ELSE
    RAISE NOTICE 'FK fk_booking_events_booking_id on public.booking_events already exists, skipping.';
  END IF;
END $$;

-- FK for public.booking_locations.booking_id -> public.bookings.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_locations_booking_id' AND conrelid = 'public.booking_locations'::regclass) THEN
    ALTER TABLE public.booking_locations
      ADD CONSTRAINT fk_booking_locations_booking_id
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK fk_booking_locations_booking_id to public.booking_locations';
  ELSE
    RAISE NOTICE 'FK fk_booking_locations_booking_id on public.booking_locations already exists, skipping.';
  END IF;
END $$;

-- FK for public.booking_media.booking_id -> public.bookings.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_media_booking_id' AND conrelid = 'public.booking_media'::regclass) THEN
    ALTER TABLE public.booking_media
      ADD CONSTRAINT fk_booking_media_booking_id
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK fk_booking_media_booking_id to public.booking_media';
  ELSE
    RAISE NOTICE 'FK fk_booking_media_booking_id on public.booking_media already exists, skipping.';
  END IF;
END $$;

-- FK for public.disputes.booking_id -> public.bookings.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_disputes_booking_id' AND conrelid = 'public.disputes'::regclass) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT fk_disputes_booking_id
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added FK fk_disputes_booking_id to public.disputes';
  ELSE
    RAISE NOTICE 'FK fk_disputes_booking_id on public.disputes already exists, skipping.';
  END IF;
END $$;

-- FK for public.disputes.payment_id -> public.payments.id
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_disputes_payment_id' AND conrelid = 'public.disputes'::regclass) THEN
      ALTER TABLE public.disputes
        ADD CONSTRAINT fk_disputes_payment_id
        FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added FK fk_disputes_payment_id to public.disputes for payments.id';
    ELSE
      RAISE NOTICE 'FK fk_disputes_payment_id on public.disputes already exists, skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Table public.payments does not exist, skipping FK for disputes.payment_id';
  END IF;
END $$;

-- FK for public.dispute_evidence_items.dispute_id -> public.disputes.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dispute_evidence_items_dispute_id' AND conrelid = 'public.dispute_evidence_items'::regclass) THEN
    ALTER TABLE public.dispute_evidence_items
      ADD CONSTRAINT fk_dispute_evidence_items_dispute_id
      FOREIGN KEY (dispute_id) REFERENCES public.disputes(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK fk_dispute_evidence_items_dispute_id to public.dispute_evidence_items';
  ELSE
    RAISE NOTICE 'FK fk_dispute_evidence_items_dispute_id on public.dispute_evidence_items already exists, skipping.';
  END IF;
END $$;

-- FK for public.dispute_evidence_items.booking_media_id -> public.booking_media.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dispute_evidence_items_booking_media_id' AND conrelid = 'public.dispute_evidence_items'::regclass) THEN
    ALTER TABLE public.dispute_evidence_items
      ADD CONSTRAINT fk_dispute_evidence_items_booking_media_id
      FOREIGN KEY (booking_media_id) REFERENCES public.booking_media(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added FK fk_dispute_evidence_items_booking_media_id to public.dispute_evidence_items';
  ELSE
    RAISE NOTICE 'FK fk_dispute_evidence_items_booking_media_id on public.dispute_evidence_items already exists, skipping.';
  END IF;
END $$;

-- FK for public.car_availability.booking_id -> public.bookings.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_car_availability_booking_id' AND conrelid = 'public.car_availability'::regclass) THEN
    ALTER TABLE public.car_availability
      ADD CONSTRAINT fk_car_availability_booking_id
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added FK fk_car_availability_booking_id to public.car_availability';
  ELSE
    RAISE NOTICE 'FK fk_car_availability_booking_id on public.car_availability already exists, skipping.';
  END IF;
END $$;

-- Trigger for updated_at on new tables that need it
-- Assuming 'update_modified_column()' function exists from a previous migration.
-- If not, it needs to be created:
-- CREATE OR REPLACE FUNCTION update_modified_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--    NEW.updated_at = now();
--    RETURN NEW;
-- END;
-- $$ language 'plpgsql';

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_modified_column') THEN
    -- Trigger for booking_locations
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_booking_locations_timestamp' AND tgrelid = 'public.booking_locations'::regclass) THEN
      CREATE TRIGGER update_booking_locations_timestamp
      BEFORE UPDATE ON public.booking_locations
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
      RAISE NOTICE 'Created trigger update_booking_locations_timestamp on public.booking_locations.';
    ELSE
      RAISE NOTICE 'Trigger update_booking_locations_timestamp on public.booking_locations already exists, skipping.';
    END IF;

    -- Trigger for disputes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_disputes_timestamp' AND tgrelid = 'public.disputes'::regclass) THEN
      CREATE TRIGGER update_disputes_timestamp
      BEFORE UPDATE ON public.disputes
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
      RAISE NOTICE 'Created trigger update_disputes_timestamp on public.disputes.';
    ELSE
      RAISE NOTICE 'Trigger update_disputes_timestamp on public.disputes already exists, skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Function update_modified_column() does not exist. Skipping updated_at triggers.';
  END IF;
END;
$$; 