-- Migration: Add booking related schemas, tables, enums, and triggers  

-- 1) Ensure required extension for UUID generation exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
-- 2) Enumerated types ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_enum') THEN
    CREATE TYPE booking_status_enum AS ENUM ('pending', 'authorized', 'booked', 'active', 'completed', 'cancelled');
  END IF;
END$$
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE payment_status_enum AS ENUM ('none', 'authorized', 'captured', 'refunded');
  END IF;
END$$
-- 3) Core tables --------------------------------------------------------------

-- 3a. customers
CREATE TABLE IF NOT EXISTS public.customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        TEXT NOT NULL UNIQUE,
  first_name   TEXT,
  last_name    TEXT,
  phone        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
)
-- 3b. bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  car_id         UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  total_price    NUMERIC(10,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  status         booking_status_enum NOT NULL DEFAULT 'pending',
  payment_status payment_status_enum NOT NULL DEFAULT 'none',
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date >= start_date)
)
-- 3c. payments
CREATE TABLE IF NOT EXISTS public.payments (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id             UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  paypal_order_id        TEXT,
  paypal_authorization_id TEXT,
  amount                 NUMERIC(10,2) NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'USD',
  status                 payment_status_enum NOT NULL DEFAULT 'none',
  captured_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
)
-- 4) update_modified_column helper trigger (re-use if already present) --------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_modified_column') THEN
    CREATE OR REPLACE FUNCTION update_modified_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END$$
-- Attach the trigger to tables that have an updated_at field
CREATE TRIGGER update_bookings_timestamp
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION update_modified_column()
CREATE TRIGGER update_payments_timestamp
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION update_modified_column()
-- 5) Trigger to free up availability when a booking is cancelled -------------
CREATE OR REPLACE FUNCTION public.free_car_availability_after_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.car_availability
      SET status = 'available', booking_id = NULL, updated_at = now()
      WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
DROP TRIGGER IF EXISTS trg_free_car_availability_after_cancel ON public.bookings
CREATE TRIGGER trg_free_car_availability_after_cancel
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.free_car_availability_after_cancel()
-- 5b) Trigger to mark availability as booked when payment captured or status set to booked
CREATE OR REPLACE FUNCTION public.confirm_car_availability_after_confirm()
RETURNS TRIGGER AS $$
BEGIN
  IF (
        (NEW.payment_status = 'captured' AND OLD.payment_status <> 'captured') OR
        (NEW.status = 'booked'     AND OLD.status <> 'booked')
     ) THEN
    UPDATE public.car_availability
      SET status = 'booked', updated_at = now()
      WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
DROP TRIGGER IF EXISTS trg_confirm_car_availability_after_confirm ON public.bookings
CREATE TRIGGER trg_confirm_car_availability_after_confirm
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.confirm_car_availability_after_confirm()
-- 6) Row Level Security -------------------------------------------------------
-- Enable RLS on new tables (policies kept permissive for now; tighten later)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY
ALTER TABLE public.bookings  ENABLE ROW LEVEL SECURITY
ALTER TABLE public.payments  ENABLE ROW LEVEL SECURITY
-- Customers: allow anyone to insert/update their own record (placeholder)
DROP POLICY IF EXISTS "Public manage customers" ON public.customers
CREATE POLICY "Public manage customers"
  ON public.customers
  FOR ALL
  USING (true)
  WITH CHECK (true)
-- Bookings: remove owner/email-based policies ------------------------------------------------
DROP POLICY IF EXISTS "User can read own bookings" ON public.bookings
DROP POLICY IF EXISTS "User can insert bookings" ON public.bookings
-- Public (anonymous) can insert bookings
CREATE POLICY "Public insert bookings"
  ON public.bookings
  FOR INSERT
  WITH CHECK (true)
-- Admin can manage all bookings (select, update, delete)
CREATE POLICY "Admin manage bookings"
  ON public.bookings
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin')
-- Payments: restrict for now to admin only (placeholder)
DROP POLICY IF EXISTS "Admin manage payments" ON public.payments
CREATE POLICY "Admin manage payments"
  ON public.payments
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin')
-- 7) Indexes ------------------------------------------------------------------
-- Ensure quick lookup for availability freeing
CREATE INDEX IF NOT EXISTS idx_car_availability_booking_id ON public.car_availability(booking_id)
-- 8) Done -------------------------------------------------------------------- 

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_enum') AND
     NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'booked' AND enumtypid = 'booking_status_enum'::regtype) THEN
    ALTER TYPE booking_status_enum ADD VALUE 'booked';
  END IF;
END$$