-- Create booking_overall_status_enum (replaces/enhances existing booking_status_enum logic)
DO $$ BEGIN
  CREATE TYPE booking_overall_status_enum AS ENUM (
    'pending_customer_action', 'pending_payment', 'pending_contract', 'upcoming',
    'active', 'post_rental_finalization', 'completed', 'cancelled', 'disputed'
  );
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "booking_overall_status_enum" already exists, skipping';
END $$;

-- Modify payment_status_enum (add new values)
DO $$ BEGIN
  ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'value ''pending'' already exists in enum payment_status_enum';
  WHEN undefined_object THEN RAISE NOTICE 'enum payment_status_enum does not exist, skipping ADD VALUE ''pending''';
END $$;
DO $$ BEGIN
  ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'voided';
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'value ''voided'' already exists in enum payment_status_enum';
  WHEN undefined_object THEN RAISE NOTICE 'enum payment_status_enum does not exist, skipping ADD VALUE ''voided''';
END $$;
DO $$ BEGIN
  ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'failed';
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'value ''failed'' already exists in enum payment_status_enum';
  WHEN undefined_object THEN RAISE NOTICE 'enum payment_status_enum does not exist, skipping ADD VALUE ''failed''';
END $$;

-- Create contract_status_enum (New)
DO $$ BEGIN
  CREATE TYPE contract_status_enum AS ENUM (
    'not_sent', 'sent', 'viewed', 'signed', 'declined', 'voided'
  );
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "contract_status_enum" already exists, skipping';
END $$;

-- Create car_availability_status_enum (New/Modify from CHECK constraint)
DO $$ BEGIN
  CREATE TYPE car_availability_status_enum AS ENUM (
    'available', 'pending_confirmation', 'booked', 'maintenance'
  );
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "car_availability_status_enum" already exists, skipping';
END $$;

-- Create booking_event_type_enum (New)
DO $$ BEGIN
  CREATE TYPE booking_event_type_enum AS ENUM (
    'booking_created', 'booking_cancelled', 'booking_updated', 'status_changed_overall',
    'status_changed_payment', 'status_changed_contract', 'payment_initiated', 'payment_authorized',
    'payment_authorization_failed', 'payment_captured', 'payment_capture_failed', 'payment_voided',
    'payment_refunded', 'contract_sent', 'contract_viewed', 'contract_signed', 'contract_declined',
    'car_picked_up', 'car_returned', 'vehicle_inspected_pickup', 'vehicle_inspected_return',
    'email_sent', 'email_delivered', 'email_opened', 'email_bounced', 'admin_note_added',
    'admin_manual_override', 'dispute_opened', 'dispute_evidence_submitted', 'dispute_resolved',
    'system_reminder_sent'
  );
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "booking_event_type_enum" already exists, skipping';
END $$;

-- Create enums for booking_media (New)
DO $$ BEGIN
  CREATE TYPE booking_media_type_enum AS ENUM ('photo', 'video', 'pdf', 'other');
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "booking_media_type_enum" already exists, skipping';
END $$;

DO $$ BEGIN
  CREATE TYPE booking_media_stage_enum AS ENUM (
    'pickup_pre_rental', 'dropoff_post_rental', 'rental_agreement', 'id_scan',
    'dispute_evidence', 'general_attachment'
  );
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "booking_media_stage_enum" already exists, skipping';
END $$;

DO $$ BEGIN
  CREATE TYPE booking_media_uploader_enum AS ENUM ('customer', 'admin', 'system');
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "booking_media_uploader_enum" already exists, skipping';
END $$;

-- Create booking_location_type_enum (New)
DO $$ BEGIN
  CREATE TYPE booking_location_type_enum AS ENUM ('pickup', 'dropoff');
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "booking_location_type_enum" already exists, skipping';
END $$;

-- Create actor_type_enum (New)
DO $$ BEGIN
  CREATE TYPE actor_type_enum AS ENUM (
    'customer', 'admin', 'system', 'webhook_paypal', 'webhook_resend', 'webhook_esignature'
  );
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "actor_type_enum" already exists, skipping';
END $$;

-- Create paypal_invoice_status_enum (New)
DO $$ BEGIN
  CREATE TYPE paypal_invoice_status_enum AS ENUM (
    'DRAFT', 'SENT', 'SCHEDULED', 'PAYMENT_PENDING', 'PAID', 'MARKED_AS_PAID',
    'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'MARKED_AS_REFUNDED', 'VOIDED'
  );
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'type "paypal_invoice_status_enum" already exists, skipping';
END $$; 