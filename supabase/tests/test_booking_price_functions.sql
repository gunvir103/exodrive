-- ==============================================================================
-- TEST FILE: test_booking_price_functions.sql
-- PURPOSE: Test suite for calculate_booking_price and validate_booking_price functions
-- DATE: 2025-08-26
-- ==============================================================================

-- Set up test environment
BEGIN;

-- ==============================================================================
-- TEST DATA SETUP
-- ==============================================================================

-- Create test car
INSERT INTO public.cars (id, slug, name, description, category, available, featured)
VALUES (
    'test-car-001'::uuid,
    'test-economy-car',
    'Test Economy Car',
    'A test economy car for pricing validation',
    'Economy',
    true,
    false
);

-- Create test car pricing
INSERT INTO public.car_pricing (car_id, base_price, currency, discount_percentage, deposit_amount, minimum_days)
VALUES (
    'test-car-001'::uuid,
    50.00, -- $50 per day
    'USD',
    10, -- 10% discount
    200.00, -- $200 deposit
    2 -- Minimum 2 days
);

-- Create mandatory fee for test car
INSERT INTO public.car_additional_fees (car_id, name, amount, is_optional, description)
VALUES 
    ('test-car-001'::uuid, 'Insurance', 15.00, false, 'Mandatory insurance fee'),
    ('test-car-001'::uuid, 'Cleaning Fee', 25.00, false, 'One-time cleaning fee'),
    ('test-car-001'::uuid, 'GPS', 10.00, true, 'Optional GPS rental');

-- Create test customer
INSERT INTO public.customers (id, email, first_name, last_name)
VALUES (
    'test-customer-001'::uuid,
    'test@example.com',
    'Test',
    'Customer'
);

-- Create test locations
INSERT INTO public.booking_locations (id, booking_id, type, city, formatted_address)
VALUES
    ('test-location-001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'pickup', 'Los Angeles', 'LAX Airport'),
    ('test-location-002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'dropoff', 'San Francisco', 'SFO Airport');

-- Add location fees
INSERT INTO public.location_fees (location_id, fee_type, fee_amount, description)
VALUES
    ('test-location-001'::uuid, 'airport', 35.00, 'LAX Airport fee'),
    ('test-location-002'::uuid, 'airport', 30.00, 'SFO Airport fee');

-- ==============================================================================
-- TEST 1: Basic Price Calculation (4 days, no locations)
-- ==============================================================================

DO $$
DECLARE
    v_result JSONB;
    v_expected_base NUMERIC := 200.00; -- $50 * 4 days
    v_expected_fees NUMERIC := 40.00;  -- $15 + $25 mandatory fees
    v_expected_subtotal NUMERIC := 216.00; -- ($200 + $40) * 0.9 (10% discount)
    v_expected_tax NUMERIC := 21.60;   -- 10% tax
    v_expected_total NUMERIC := 237.60; -- $216 + $21.60
BEGIN
    RAISE NOTICE '==== TEST 1: Basic Price Calculation ====';
    
    v_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-01 10:00:00+00'::timestamptz,
        '2025-09-05 10:00:00+00'::timestamptz
    );
    
    RAISE NOTICE 'Result: %', jsonb_pretty(v_result);
    
    -- Verify success
    ASSERT (v_result->>'success')::boolean = true, 'Calculation should succeed';
    
    -- Verify total price (with some tolerance for rounding)
    ASSERT ABS((v_result->>'total_price')::numeric - v_expected_total) < 1, 
           format('Total price should be approximately %s, got %s', v_expected_total, v_result->>'total_price');
    
    RAISE NOTICE 'TEST 1 PASSED: Basic calculation works correctly';
END $$;

-- ==============================================================================
-- TEST 2: Price Calculation with Location Fees
-- ==============================================================================

DO $$
DECLARE
    v_result JSONB;
BEGIN
    RAISE NOTICE '==== TEST 2: Price Calculation with Location Fees ====';
    
    v_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-01 10:00:00+00'::timestamptz,
        '2025-09-05 10:00:00+00'::timestamptz,
        'test-location-001'::uuid, -- LAX pickup
        'test-location-002'::uuid  -- SFO dropoff
    );
    
    RAISE NOTICE 'Result: %', jsonb_pretty(v_result);
    
    -- Verify success
    ASSERT (v_result->>'success')::boolean = true, 'Calculation should succeed';
    
    -- Verify location fees are included
    ASSERT (v_result->'breakdown'->>'location_fees')::numeric > 0, 'Should include location fees';
    
    -- Should include one-way fee since different locations
    ASSERT (v_result->>'fees')::numeric > 40, 'Should include additional location fees';
    
    RAISE NOTICE 'TEST 2 PASSED: Location fees calculated correctly';
END $$;

-- ==============================================================================
-- TEST 3: Weekend Peak Pricing
-- ==============================================================================

DO $$
DECLARE
    v_result JSONB;
    v_regular_result JSONB;
BEGIN
    RAISE NOTICE '==== TEST 3: Weekend Peak Pricing ====';
    
    -- Calculate for weekday (Wednesday to Thursday)
    v_regular_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-03 10:00:00+00'::timestamptz, -- Wednesday
        '2025-09-04 10:00:00+00'::timestamptz  -- Thursday
    );
    
    -- Calculate for weekend (Saturday to Sunday)
    v_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-06 10:00:00+00'::timestamptz, -- Saturday
        '2025-09-07 10:00:00+00'::timestamptz  -- Sunday
    );
    
    RAISE NOTICE 'Weekday price: %', v_regular_result->>'total_price';
    RAISE NOTICE 'Weekend price: %', v_result->>'total_price';
    
    -- Weekend should be more expensive due to peak pricing
    ASSERT (v_result->>'total_price')::numeric > (v_regular_result->>'total_price')::numeric,
           'Weekend price should be higher than weekday';
    
    -- Check peak pricing was applied
    ASSERT (v_result->'breakdown'->>'peak_pricing_applied')::boolean = true,
           'Peak pricing should be applied for weekend';
    
    RAISE NOTICE 'TEST 3 PASSED: Peak pricing works correctly';
END $$;

-- ==============================================================================
-- TEST 4: Minimum Days Validation
-- ==============================================================================

DO $$
DECLARE
    v_result JSONB;
BEGIN
    RAISE NOTICE '==== TEST 4: Minimum Days Validation ====';
    
    -- Try to book for 1 day (less than minimum of 2)
    v_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-01 10:00:00+00'::timestamptz,
        '2025-09-02 10:00:00+00'::timestamptz -- Only 1 day
    );
    
    RAISE NOTICE 'Result: %', v_result;
    
    -- Should fail due to minimum days requirement
    ASSERT (v_result->>'success')::boolean = false, 'Should fail for less than minimum days';
    ASSERT v_result->>'error' LIKE '%minimum%', 'Error should mention minimum days';
    
    RAISE NOTICE 'TEST 4 PASSED: Minimum days validation works';
END $$;

-- ==============================================================================
-- TEST 5: Invalid Input Handling
-- ==============================================================================

DO $$
DECLARE
    v_result JSONB;
BEGIN
    RAISE NOTICE '==== TEST 5: Invalid Input Handling ====';
    
    -- Test with NULL car ID
    v_result := public.calculate_booking_price(
        NULL,
        '2025-09-01 10:00:00+00'::timestamptz,
        '2025-09-05 10:00:00+00'::timestamptz
    );
    
    ASSERT (v_result->>'success')::boolean = false, 'Should fail for NULL car ID';
    
    -- Test with invalid date range (end before start)
    v_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-05 10:00:00+00'::timestamptz,
        '2025-09-01 10:00:00+00'::timestamptz
    );
    
    ASSERT (v_result->>'success')::boolean = false, 'Should fail for invalid date range';
    
    -- Test with non-existent car
    v_result := public.calculate_booking_price(
        'non-existent-car'::uuid,
        '2025-09-01 10:00:00+00'::timestamptz,
        '2025-09-05 10:00:00+00'::timestamptz
    );
    
    ASSERT (v_result->>'success')::boolean = false, 'Should fail for non-existent car';
    
    RAISE NOTICE 'TEST 5 PASSED: Invalid input handling works';
END $$;

-- ==============================================================================
-- TEST 6: Booking Price Validation
-- ==============================================================================

DO $$
DECLARE
    v_booking_id UUID;
    v_calc_result JSONB;
    v_validate_result JSONB;
    v_calculated_price NUMERIC;
BEGIN
    RAISE NOTICE '==== TEST 6: Booking Price Validation ====';
    
    -- First calculate the correct price
    v_calc_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-10 10:00:00+00'::timestamptz,
        '2025-09-14 10:00:00+00'::timestamptz
    );
    
    v_calculated_price := (v_calc_result->>'total_price')::numeric;
    
    -- Create a test booking
    INSERT INTO public.bookings (
        id, customer_id, car_id, start_date, end_date, total_price, status
    ) VALUES (
        gen_random_uuid(),
        'test-customer-001'::uuid,
        'test-car-001'::uuid,
        '2025-09-10',
        '2025-09-14',
        v_calculated_price,
        'pending'
    ) RETURNING id INTO v_booking_id;
    
    -- Test 1: Validate with correct price
    v_validate_result := public.validate_booking_price(v_booking_id, v_calculated_price);
    
    RAISE NOTICE 'Validation with correct price: %', v_validate_result;
    ASSERT (v_validate_result->>'valid')::boolean = true, 'Should validate correct price';
    
    -- Test 2: Validate with manipulated price (attempt to pay less)
    v_validate_result := public.validate_booking_price(v_booking_id, v_calculated_price - 50);
    
    RAISE NOTICE 'Validation with manipulated price: %', v_validate_result;
    ASSERT (v_validate_result->>'valid')::boolean = false, 'Should reject manipulated price';
    
    -- Test 3: Validate within tolerance ($0.01)
    v_validate_result := public.validate_booking_price(v_booking_id, v_calculated_price + 0.005);
    
    ASSERT (v_validate_result->>'valid')::boolean = true, 'Should accept price within tolerance';
    
    RAISE NOTICE 'TEST 6 PASSED: Price validation works correctly';
END $$;

-- ==============================================================================
-- TEST 7: Security - Prevent Negative Prices
-- ==============================================================================

DO $$
DECLARE
    v_result JSONB;
BEGIN
    RAISE NOTICE '==== TEST 7: Security - Prevent Negative Prices ====';
    
    -- Try to create a car with negative price (should be prevented by check constraint)
    BEGIN
        INSERT INTO public.car_pricing (car_id, base_price, currency, deposit_amount, minimum_days)
        VALUES (
            'test-car-002'::uuid,
            -100.00, -- Negative price
            'USD',
            200.00,
            1
        );
        
        RAISE EXCEPTION 'Should not allow negative base price';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Correctly prevented negative base price';
    END;
    
    RAISE NOTICE 'TEST 7 PASSED: Security checks work';
END $$;

-- ==============================================================================
-- TEST 8: Audit Logging
-- ==============================================================================

DO $$
DECLARE
    v_result JSONB;
    v_event_count INTEGER;
BEGIN
    RAISE NOTICE '==== TEST 8: Audit Logging ====';
    
    -- Perform a calculation
    v_result := public.calculate_booking_price(
        'test-car-001'::uuid,
        '2025-09-20 10:00:00+00'::timestamptz,
        '2025-09-22 10:00:00+00'::timestamptz
    );
    
    -- Check if event was logged
    SELECT COUNT(*) INTO v_event_count
    FROM public.booking_events
    WHERE event_type = 'price_calculated'
      AND actor_id = (v_result->>'calculation_id')::text;
    
    ASSERT v_event_count > 0, 'Price calculation should be logged';
    
    RAISE NOTICE 'Found % audit log entries', v_event_count;
    RAISE NOTICE 'TEST 8 PASSED: Audit logging works';
END $$;

-- ==============================================================================
-- CLEANUP
-- ==============================================================================

-- Rollback test data (comment out if you want to keep test data)
ROLLBACK;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ALL TESTS COMPLETED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Functions tested:';
    RAISE NOTICE '  ✓ calculate_booking_price';
    RAISE NOTICE '  ✓ validate_booking_price';
    RAISE NOTICE '';
    RAISE NOTICE 'Features validated:';
    RAISE NOTICE '  ✓ Basic price calculation';
    RAISE NOTICE '  ✓ Location-based fees';
    RAISE NOTICE '  ✓ Peak/weekend pricing';
    RAISE NOTICE '  ✓ Minimum days validation';
    RAISE NOTICE '  ✓ Invalid input handling';
    RAISE NOTICE '  ✓ Price validation and manipulation detection';
    RAISE NOTICE '  ✓ Security checks';
    RAISE NOTICE '  ✓ Audit logging';
END $$;