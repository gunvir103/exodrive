-- Migration: Add mock booking data for development
-- This migration is safe to run multiple times and will only insert data if none exists

-- First, ensure we have at least one car to book
DO $$
DECLARE
  v_car_id UUID;
  v_customer_id UUID;
  v_booking_id UUID;
  v_payment_id UUID;
BEGIN
  -- Get the first available car, or skip if no cars exist
  SELECT id INTO v_car_id 
  FROM cars 
  WHERE available = true AND hidden = false
  LIMIT 1;
  
  IF v_car_id IS NULL THEN
    RAISE NOTICE 'No available cars found. Skipping mock booking creation.';
    RETURN;
  END IF;

  -- Check if we already have mock bookings
  IF EXISTS (SELECT 1 FROM bookings LIMIT 1) THEN
    RAISE NOTICE 'Bookings already exist. Skipping mock data creation.';
    RETURN;
  END IF;

  -- Create mock customer 1
  INSERT INTO customers (email, first_name, last_name, phone)
  VALUES ('john.doe@example.com', 'John', 'Doe', '+1 (555) 123-4567')
  RETURNING id INTO v_customer_id;

  -- Create upcoming booking (starts in 5 days)
  INSERT INTO bookings (
    customer_id, car_id, start_date, end_date, 
    total_price, currency, overall_status, 
    payment_status, contract_status,
    paypal_order_id, paypal_capture_id
  )
  VALUES (
    v_customer_id, 
    v_car_id, 
    CURRENT_DATE + INTERVAL '5 days', 
    CURRENT_DATE + INTERVAL '8 days',
    1200.00, 
    'USD', 
    'upcoming',
    'authorized',
    'sent',
    'PAYPAL-ORDER-' || substr(md5(random()::text), 1, 8),
    'PAYPAL-AUTH-' || substr(md5(random()::text), 1, 8)
  )
  RETURNING id INTO v_booking_id;

  -- Create payment record for booking 1
  INSERT INTO payments (
    booking_id, 
    paypal_order_id, 
    paypal_authorization_id,
    amount, 
    currency, 
    status,
    payment_type
  )
  VALUES (
    v_booking_id,
    'PAYPAL-ORDER-' || substr(md5(random()::text), 1, 8),
    'PAYPAL-AUTH-' || substr(md5(random()::text), 1, 8),
    1200.00,
    'USD',
    'authorized',
    'paypal'
  );

  -- Create mock customer 2
  INSERT INTO customers (email, first_name, last_name, phone)
  VALUES ('jane.smith@example.com', 'Jane', 'Smith', '+1 (555) 987-6543')
  RETURNING id INTO v_customer_id;

  -- Create active booking (started 2 days ago)
  INSERT INTO bookings (
    customer_id, car_id, start_date, end_date, 
    total_price, currency, overall_status, 
    payment_status, contract_status,
    paypal_order_id, paypal_capture_id,
    capture_scheduled_for
  )
  VALUES (
    v_customer_id, 
    v_car_id, 
    CURRENT_DATE - INTERVAL '2 days', 
    CURRENT_DATE + INTERVAL '3 days',
    2000.00, 
    'USD', 
    'active',
    'captured',
    'signed',
    'PAYPAL-ORDER-' || substr(md5(random()::text), 1, 8),
    'PAYPAL-CAPTURE-' || substr(md5(random()::text), 1, 8),
    CURRENT_DATE - INTERVAL '2 days' -- Should have been captured already
  )
  RETURNING id INTO v_booking_id;

  -- Create payment record for booking 2
  INSERT INTO payments (
    booking_id, 
    paypal_order_id, 
    paypal_capture_id,
    amount, 
    currency, 
    status,
    payment_type
  )
  VALUES (
    v_booking_id,
    'PAYPAL-ORDER-' || substr(md5(random()::text), 1, 8),
    'PAYPAL-CAPTURE-' || substr(md5(random()::text), 1, 8),
    2000.00,
    'USD',
    'captured',
    'paypal'
  );

  -- Create some availability records for the bookings
  INSERT INTO car_availability (car_id, date, status, booking_id)
  SELECT 
    v_car_id,
    generate_series::date,
    'booked',
    v_booking_id
  FROM generate_series(
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '3 days',
    '1 day'::interval
  );

  -- Add mock email records for the inbox
  INSERT INTO email_events (
    resend_email_id,
    last_event_type,
    recipient_email,
    sender_email,
    subject,
    booking_id,
    opened_at,
    clicked_at,
    raw_payload
  )
  VALUES 
  -- Email for first booking (opened)
  (
    'resend_' || substr(md5(random()::text), 1, 16),
    'email.opened',
    'john.doe@example.com',
    'bookings@exodrive.com',
    'Your ExoDrive Booking Confirmation',
    (SELECT id FROM bookings WHERE overall_status = 'upcoming' LIMIT 1),
    NOW() - INTERVAL '1 hour',
    NULL,
    jsonb_build_object(
      'type', 'email.opened',
      'created_at', (NOW() - INTERVAL '1 hour')::text
    )
  ),
  -- Email for second booking (delivered)
  (
    'resend_' || substr(md5(random()::text), 1, 16),
    'email.delivered',
    'jane.smith@example.com',
    'bookings@exodrive.com',
    'Your ExoDrive Booking Confirmation',
    (SELECT id FROM bookings WHERE overall_status = 'active' LIMIT 1),
    NULL,
    NULL,
    jsonb_build_object(
      'type', 'email.delivered',
      'created_at', (NOW() - INTERVAL '2 days')::text
    )
  ),
  -- Contract reminder email (clicked)
  (
    'resend_' || substr(md5(random()::text), 1, 16),
    'email.clicked',
    'john.doe@example.com',
    'contracts@exodrive.com',
    'Please Sign Your Rental Agreement',
    (SELECT id FROM bookings WHERE overall_status = 'upcoming' LIMIT 1),
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '20 minutes',
    jsonb_build_object(
      'type', 'email.clicked',
      'created_at', (NOW() - INTERVAL '20 minutes')::text
    )
  );

  RAISE NOTICE 'Successfully created mock booking data';
END $$;

-- Add a comment to identify this as development data
COMMENT ON SCHEMA public IS 'Contains mock booking data for development. Remove before production deployment.';