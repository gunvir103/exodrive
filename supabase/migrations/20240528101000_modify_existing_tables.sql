-- Modify public.bookings
-- It's crucial to handle the existing 'status' column carefully.
-- Option 1: Rename old status, add new overall_status using the new enum.
-- Option 2: Try to ALTER the existing status column's enum type (can be complex if data exists and enums differ significantly).
-- Databaseplan.md leans towards creating a new overall_status or renaming.
-- Let's proceed with renaming the old 'status' to 'legacy_status' for now if it exists,
-- and then add 'overall_status' with the new enum.
-- If 'legacy_status' or 'overall_status' already exists from a partial previous attempt, this should handle it.

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'status') THEN
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'legacy_status') THEN
      ALTER TABLE public.bookings RENAME COLUMN status TO legacy_status;
      RAISE NOTICE 'Renamed public.bookings.status to legacy_status';
    ELSE
      RAISE NOTICE 'public.bookings.legacy_status already exists, assuming status was already handled or renamed.';
      -- If legacy_status exists, we might want to drop the original 'status' if it somehow reappeared or was not properly renamed.
      -- However, dropping columns with data without a clear data migration path is risky in a generic script.
      -- For now, we'll assume if legacy_status exists, the old 'status' is gone or dealt with.
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS overall_status booking_overall_status_enum DEFAULT 'pending_customer_action',
  ADD COLUMN IF NOT EXISTS contract_status contract_status_enum DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS secure_token_id UUID UNIQUE; -- FK to booking_secure_tokens.id will be added later

-- Update public.bookings.payment_status to use the modified enum and set a new default.
-- This assumes payment_status_enum was successfully altered in the previous migration.
ALTER TABLE public.bookings
  ALTER COLUMN payment_status SET DEFAULT 'pending';
  -- If `payment_status` column itself was using an old enum that was *replaced* instead of *altered*,
  -- you would need to cast its type:
  -- ALTER COLUMN payment_status TYPE payment_status_enum USING payment_status::text::payment_status_enum;


-- Modify public.car_availability
-- Drop existing CHECK constraint for status if it exists
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.car_availability'::regclass
    AND conname LIKE '%status_check%' -- Or the exact name if known
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.car_availability DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
    RAISE NOTICE 'Dropped constraint % from public.car_availability', constraint_name;
  END IF;
END;
$$;

-- Alter status column type to the new enum
-- This requires existing data in 'status' to be compatible with car_availability_status_enum values.
-- If not, a more complex data migration with a temporary column might be needed.
-- Assuming compatibility for now or that it's a new setup.
ALTER TABLE public.car_availability
  ALTER COLUMN status TYPE car_availability_status_enum
  USING status::text::car_availability_status_enum; -- Cast needed if old type was text-based

-- Ensure booking_id is UUID
-- The migration 20240320_car_tables.sql has booking_id as TEXT. This needs to be UUID.
ALTER TABLE public.car_availability
  ALTER COLUMN booking_id TYPE UUID USING booking_id::UUID; -- Cast from TEXT to UUID


-- Modify public.paypal_invoices (Enhance Existing)
ALTER TABLE public.paypal_invoices
  ADD COLUMN IF NOT EXISTS line_items JSONB,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS notes_to_recipient TEXT,
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_actor_type actor_type_enum,
  ADD COLUMN IF NOT EXISTS created_by_actor_id TEXT;

-- Change status column type to the new paypal_invoice_status_enum
-- This requires existing data in 'status' to be compatible or a CAST.
ALTER TABLE public.paypal_invoices
  ALTER COLUMN status TYPE paypal_invoice_status_enum
  USING status::text::paypal_invoice_status_enum; -- Cast needed 