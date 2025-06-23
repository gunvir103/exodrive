-- Seed data for development
-- Run this file locally using: bunx supabase db push --include-seed

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
  IF EXISTS (SELECT 1 FROM bookings WHERE customers.email IN ('john.doe@example.com', 'jane.smith@example.com') 
             FROM bookings JOIN customers ON bookings.customer_id = customers.id) THEN
    RAISE NOTICE 'Mock bookings already exist. Skipping mock data creation.';
    RETURN;
  END IF;

  -- Create mock customer 1
  INSERT INTO customers (email, first_name, last_name, phone)
  VALUES ('john.doe@example.com', 'John', 'Doe', '+1 (555) 123-4567')
  ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
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
    'PAYPAL-DEV-ORDER-001',
    'PAYPAL-DEV-AUTH-001'
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
    'PAYPAL-DEV-ORDER-001',
    'PAYPAL-DEV-AUTH-001',
    1200.00,
    'USD',
    'authorized',
    'paypal'
  );

  -- Create mock customer 2
  INSERT INTO customers (email, first_name, last_name, phone)
  VALUES ('jane.smith@example.com', 'Jane', 'Smith', '+1 (555) 987-6543')
  ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
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
    'PAYPAL-DEV-ORDER-002',
    'PAYPAL-DEV-CAPTURE-002',
    CURRENT_DATE - INTERVAL '2 days'
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
    'PAYPAL-DEV-ORDER-002',
    'PAYPAL-DEV-CAPTURE-002',
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
  )
  ON CONFLICT (car_id, date) DO UPDATE SET status = EXCLUDED.status;

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
    'resend_dev_001',
    'email.opened',
    'john.doe@example.com',
    'bookings@exodrive.com',
    'Your ExoDrive Booking Confirmation',
    (SELECT id FROM bookings WHERE paypal_order_id = 'PAYPAL-DEV-ORDER-001' LIMIT 1),
    NOW() - INTERVAL '1 hour',
    NULL,
    jsonb_build_object(
      'type', 'email.opened',
      'created_at', (NOW() - INTERVAL '1 hour')::text,
      'data', jsonb_build_object(
        'email_id', 'resend_dev_001',
        'webhook_id', 'dev_webhook_001'
      )
    )
  ),
  -- Email for second booking (delivered)
  (
    'resend_dev_002',
    'email.delivered',
    'jane.smith@example.com',
    'bookings@exodrive.com',
    'Your ExoDrive Booking Confirmation',
    (SELECT id FROM bookings WHERE paypal_order_id = 'PAYPAL-DEV-ORDER-002' LIMIT 1),
    NULL,
    NULL,
    jsonb_build_object(
      'type', 'email.delivered',
      'created_at', (NOW() - INTERVAL '2 days')::text,
      'data', jsonb_build_object(
        'email_id', 'resend_dev_002',
        'webhook_id', 'dev_webhook_002'
      )
    )
  ),
  -- Contract reminder email (clicked)
  (
    'resend_dev_003',
    'email.clicked',
    'john.doe@example.com',
    'contracts@exodrive.com',
    'Please Sign Your Rental Agreement',
    (SELECT id FROM bookings WHERE paypal_order_id = 'PAYPAL-DEV-ORDER-001' LIMIT 1),
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '20 minutes',
    jsonb_build_object(
      'type', 'email.clicked',
      'created_at', (NOW() - INTERVAL '20 minutes')::text,
      'data', jsonb_build_object(
        'email_id', 'resend_dev_003',
        'webhook_id', 'dev_webhook_003',
        'click', jsonb_build_object(
          'link', 'https://exodrive.com/sign-contract',
          'timestamp', (NOW() - INTERVAL '20 minutes')::text
        )
      )
    )
  )
  ON CONFLICT (resend_email_id) DO UPDATE SET 
    last_event_type = EXCLUDED.last_event_type,
    last_event_at = NOW();

  RAISE NOTICE 'Successfully created mock booking data';
END $$;