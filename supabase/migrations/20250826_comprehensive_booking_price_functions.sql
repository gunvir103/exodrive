-- ==============================================================================
-- MIGRATION: 20250826_comprehensive_booking_price_functions.sql
-- PURPOSE: Implement comprehensive calculate_booking_price and validate_booking_price
--          functions with location support, taxes, and security measures
-- AUTHOR: Database Migration Expert
-- DATE: 2025-08-26
-- 
-- FEATURES:
-- ✓ Enhanced calculate_booking_price with location fees
-- ✓ New validate_booking_price for booking validation
-- ✓ Configurable tax rates
-- ✓ Weekend/peak pricing support
-- ✓ Comprehensive error handling
-- ✓ Security measures against injection and overflow
-- ✓ Performance optimization with proper indexes
-- ==============================================================================

BEGIN;

-- Set explicit search_path for security
SET search_path = public, pg_temp;

-- ==============================================================================
-- CREATE TAX CONFIGURATION TABLE (if not exists)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID, -- NULL means default/global rate
    tax_rate NUMERIC(5,4) NOT NULL CHECK (tax_rate >= 0 AND tax_rate < 1), -- e.g., 0.10 for 10%
    tax_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default tax rate if not exists
INSERT INTO public.tax_configurations (tax_name, tax_rate, is_active)
SELECT 'Default Sales Tax', 0.10, true
WHERE NOT EXISTS (
    SELECT 1 FROM public.tax_configurations WHERE location_id IS NULL AND is_active = true
);

-- Create index for tax lookups
CREATE INDEX IF NOT EXISTS idx_tax_config_location_active 
ON public.tax_configurations(location_id, is_active) 
WHERE is_active = true;

-- ==============================================================================
-- CREATE LOCATION FEES TABLE (if not exists)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.location_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL,
    fee_type TEXT NOT NULL CHECK (fee_type IN ('pickup', 'dropoff', 'airport', 'remote')),
    fee_amount NUMERIC(10,2) NOT NULL CHECK (fee_amount >= 0),
    fee_percentage NUMERIC(5,4) CHECK (fee_percentage >= 0 AND fee_percentage < 1),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(location_id, fee_type)
);

-- Create index for location fee lookups
CREATE INDEX IF NOT EXISTS idx_location_fees_active 
ON public.location_fees(location_id, fee_type, is_active) 
WHERE is_active = true;

-- ==============================================================================
-- CREATE PEAK PRICING CONFIGURATION TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.peak_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    day_of_week INTEGER[], -- 0=Sunday, 6=Saturday
    multiplier NUMERIC(4,2) NOT NULL CHECK (multiplier >= 1 AND multiplier <= 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for peak pricing lookups
CREATE INDEX IF NOT EXISTS idx_peak_pricing_active 
ON public.peak_pricing_rules(is_active, start_date, end_date) 
WHERE is_active = true;

-- ==============================================================================
-- DROP EXISTING FUNCTIONS FOR CLEAN RECREATION
-- ==============================================================================

DROP FUNCTION IF EXISTS public.calculate_booking_price(UUID, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_booking_price(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.validate_booking_price(UUID, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.validate_booking_price(UUID, NUMERIC) CASCADE;

-- ==============================================================================
-- CREATE ENHANCED CALCULATE_BOOKING_PRICE FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.calculate_booking_price(
    p_car_id UUID,
    p_pickup_date TIMESTAMPTZ,
    p_dropoff_date TIMESTAMPTZ,
    p_pickup_location_id UUID DEFAULT NULL,
    p_dropoff_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    -- Core variables
    v_car_record RECORD;
    v_base_price NUMERIC(10,2);
    v_duration_hours NUMERIC;
    v_duration_days INTEGER;
    v_subtotal NUMERIC(10,2);
    
    -- Fee variables
    v_mandatory_fees NUMERIC(10,2) := 0;
    v_location_fees NUMERIC(10,2) := 0;
    v_pickup_fee NUMERIC(10,2) := 0;
    v_dropoff_fee NUMERIC(10,2) := 0;
    
    -- Tax variables
    v_tax_rate NUMERIC(5,4);
    v_taxes NUMERIC(10,2);
    
    -- Peak pricing variables
    v_peak_multiplier NUMERIC(4,2) := 1.0;
    v_peak_applied BOOLEAN := false;
    
    -- Final calculations
    v_total_before_tax NUMERIC(10,2);
    v_total_price NUMERIC(10,2);
    
    -- Breakdown details
    v_breakdown JSONB;
    v_fees_breakdown JSONB[];
    
    -- Security and validation
    v_calculation_id UUID;
    v_start_time TIMESTAMPTZ;
    
BEGIN
    -- Initialize tracking
    v_calculation_id := gen_random_uuid();
    v_start_time := clock_timestamp();
    
    -- ====================
    -- STEP 1: Input Validation
    -- ====================
    
    -- Validate required inputs
    IF p_car_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Car ID is required',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    IF p_pickup_date IS NULL OR p_dropoff_date IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pickup and dropoff dates are required',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    IF p_dropoff_date <= p_pickup_date THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Dropoff date must be after pickup date',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    -- Calculate duration
    v_duration_hours := EXTRACT(EPOCH FROM (p_dropoff_date - p_pickup_date)) / 3600;
    v_duration_days := CEIL(v_duration_hours / 24)::INTEGER;
    
    -- Validate duration limits
    IF v_duration_days < 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Minimum booking duration is 1 day',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    IF v_duration_days > 365 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Maximum booking duration is 365 days',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    -- ====================
    -- STEP 2: Fetch Car Data
    -- ====================
    
    SELECT 
        c.id,
        c.name,
        c.available,
        cp.base_price,
        cp.currency,
        cp.discount_percentage,
        cp.minimum_days,
        cp.deposit_amount
    INTO v_car_record
    FROM public.cars c
    INNER JOIN public.car_pricing cp ON c.id = cp.car_id
    WHERE c.id = p_car_id
    LIMIT 1;
    
    IF v_car_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Car not found or pricing not configured',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    IF NOT v_car_record.available THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Car is not available',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    IF v_duration_days < COALESCE(v_car_record.minimum_days, 1) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Minimum booking period is %s days', v_car_record.minimum_days),
            'calculation_id', v_calculation_id
        );
    END IF;
    
    -- ====================
    -- STEP 3: Calculate Base Price
    -- ====================
    
    v_base_price := v_car_record.base_price;
    
    -- Validate base price
    IF v_base_price IS NULL OR v_base_price <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid base price configuration',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    v_subtotal := v_base_price * v_duration_days;
    
    -- ====================
    -- STEP 4: Check Peak Pricing
    -- ====================
    
    SELECT MAX(multiplier) INTO v_peak_multiplier
    FROM public.peak_pricing_rules
    WHERE is_active = true
      AND (
        -- Date range overlap
        (start_date IS NULL OR start_date <= p_dropoff_date::date)
        AND (end_date IS NULL OR end_date >= p_pickup_date::date)
      )
      AND (
        -- Day of week match (if specified)
        day_of_week IS NULL 
        OR EXISTS (
          SELECT 1 
          FROM generate_series(p_pickup_date::date, p_dropoff_date::date - interval '1 day', '1 day'::interval) AS d
          WHERE EXTRACT(DOW FROM d)::integer = ANY(day_of_week)
        )
      );
    
    IF v_peak_multiplier > 1 THEN
        v_subtotal := v_subtotal * v_peak_multiplier;
        v_peak_applied := true;
    END IF;
    
    -- ====================
    -- STEP 5: Calculate Mandatory Fees
    -- ====================
    
    v_fees_breakdown := ARRAY[]::JSONB[];
    
    -- Add car-specific mandatory fees
    FOR v_car_record IN 
        SELECT name, amount, description
        FROM public.car_additional_fees
        WHERE car_id = p_car_id 
          AND is_optional = false
          AND amount > 0
        ORDER BY amount DESC
    LOOP
        v_mandatory_fees := v_mandatory_fees + v_car_record.amount;
        v_fees_breakdown := array_append(
            v_fees_breakdown,
            jsonb_build_object(
                'type', 'mandatory',
                'name', v_car_record.name,
                'amount', v_car_record.amount,
                'description', v_car_record.description
            )
        );
    END LOOP;
    
    -- ====================
    -- STEP 6: Calculate Location Fees
    -- ====================
    
    -- Pickup location fees
    IF p_pickup_location_id IS NOT NULL THEN
        SELECT COALESCE(SUM(
            CASE 
                WHEN fee_percentage IS NOT NULL THEN v_subtotal * fee_percentage
                ELSE fee_amount
            END
        ), 0) INTO v_pickup_fee
        FROM public.location_fees
        WHERE location_id = p_pickup_location_id
          AND is_active = true;
        
        IF v_pickup_fee > 0 THEN
            v_location_fees := v_location_fees + v_pickup_fee;
            v_fees_breakdown := array_append(
                v_fees_breakdown,
                jsonb_build_object(
                    'type', 'location',
                    'name', 'Pickup Location Fee',
                    'amount', v_pickup_fee,
                    'location_id', p_pickup_location_id
                )
            );
        END IF;
    END IF;
    
    -- Dropoff location fees (if different from pickup)
    IF p_dropoff_location_id IS NOT NULL AND p_dropoff_location_id != COALESCE(p_pickup_location_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        SELECT COALESCE(SUM(
            CASE 
                WHEN fee_percentage IS NOT NULL THEN v_subtotal * fee_percentage
                ELSE fee_amount
            END
        ), 0) INTO v_dropoff_fee
        FROM public.location_fees
        WHERE location_id = p_dropoff_location_id
          AND is_active = true;
        
        IF v_dropoff_fee > 0 THEN
            v_location_fees := v_location_fees + v_dropoff_fee;
            v_fees_breakdown := array_append(
                v_fees_breakdown,
                jsonb_build_object(
                    'type', 'location',
                    'name', 'Dropoff Location Fee',
                    'amount', v_dropoff_fee,
                    'location_id', p_dropoff_location_id
                )
            );
        END IF;
    END IF;
    
    -- One-way fee if different locations
    IF p_pickup_location_id IS NOT NULL 
       AND p_dropoff_location_id IS NOT NULL 
       AND p_pickup_location_id != p_dropoff_location_id THEN
        -- Add a fixed one-way fee (could be made configurable)
        v_location_fees := v_location_fees + 50; -- $50 one-way fee
        v_fees_breakdown := array_append(
            v_fees_breakdown,
            jsonb_build_object(
                'type', 'location',
                'name', 'One-Way Rental Fee',
                'amount', 50.00
            )
        );
    END IF;
    
    -- ====================
    -- STEP 7: Apply Discount
    -- ====================
    
    v_total_before_tax := v_subtotal + v_mandatory_fees + v_location_fees;
    
    IF v_car_record.discount_percentage IS NOT NULL AND v_car_record.discount_percentage > 0 THEN
        v_total_before_tax := v_total_before_tax * (1 - v_car_record.discount_percentage / 100);
    END IF;
    
    -- ====================
    -- STEP 8: Calculate Taxes
    -- ====================
    
    -- Get applicable tax rate (prefer location-specific, fallback to default)
    SELECT tax_rate INTO v_tax_rate
    FROM public.tax_configurations
    WHERE is_active = true
      AND (location_id = p_pickup_location_id OR location_id IS NULL)
    ORDER BY location_id NULLS LAST
    LIMIT 1;
    
    v_tax_rate := COALESCE(v_tax_rate, 0.10); -- Default 10% if no config
    v_taxes := v_total_before_tax * v_tax_rate;
    
    -- ====================
    -- STEP 9: Calculate Final Price
    -- ====================
    
    v_total_price := v_total_before_tax + v_taxes;
    
    -- Validate final price
    IF v_total_price < 0 THEN
        -- Log security alert
        INSERT INTO public.booking_events (
            booking_id, event_type, timestamp, actor_type, actor_id,
            details, summary_text
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::uuid,
            'system_error'::public.booking_event_type_enum,
            now(),
            'system'::public.actor_type_enum,
            v_calculation_id::TEXT,
            jsonb_build_object(
                'error', 'Negative price calculated',
                'car_id', p_car_id,
                'subtotal', v_subtotal,
                'fees', v_mandatory_fees + v_location_fees,
                'taxes', v_taxes
            ),
            'SECURITY ALERT: Negative price detected'
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid price calculation',
            'calculation_id', v_calculation_id
        );
    END IF;
    
    -- ====================
    -- STEP 10: Build Response
    -- ====================
    
    v_breakdown := jsonb_build_object(
        'base_price_per_day', v_car_record.base_price,
        'duration_days', v_duration_days,
        'duration_hours', v_duration_hours,
        'subtotal', v_subtotal,
        'mandatory_fees', v_mandatory_fees,
        'location_fees', v_location_fees,
        'pickup_fee', v_pickup_fee,
        'dropoff_fee', v_dropoff_fee,
        'peak_pricing_applied', v_peak_applied,
        'peak_multiplier', v_peak_multiplier,
        'discount_percentage', v_car_record.discount_percentage,
        'tax_rate', v_tax_rate * 100, -- Convert to percentage
        'taxes', v_taxes,
        'deposit_required', v_car_record.deposit_amount,
        'fees_breakdown', v_fees_breakdown
    );
    
    -- Log successful calculation
    INSERT INTO public.booking_events (
        booking_id, event_type, timestamp, actor_type, actor_id,
        details, summary_text
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'price_calculated'::public.booking_event_type_enum,
        now(),
        'system'::public.actor_type_enum,
        v_calculation_id::TEXT,
        jsonb_build_object(
            'car_id', p_car_id,
            'car_name', v_car_record.name,
            'pickup_date', p_pickup_date,
            'dropoff_date', p_dropoff_date,
            'total_price', v_total_price,
            'breakdown', v_breakdown
        ),
        format('Price calculated: %s %s for %s days', 
               v_total_price, v_car_record.currency, v_duration_days)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'base_price', v_subtotal,
        'fees', v_mandatory_fees + v_location_fees,
        'taxes', v_taxes,
        'total_price', v_total_price,
        'currency', COALESCE(v_car_record.currency, 'USD'),
        'breakdown', v_breakdown,
        'calculation_id', v_calculation_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO public.booking_events (
            booking_id, event_type, timestamp, actor_type, actor_id,
            details, summary_text
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::uuid,
            'system_error'::public.booking_event_type_enum,
            now(),
            'system'::public.actor_type_enum,
            COALESCE(v_calculation_id::TEXT, 'error'),
            jsonb_build_object(
                'function', 'calculate_booking_price',
                'error', SQLERRM,
                'sqlstate', SQLSTATE,
                'car_id', p_car_id
            ),
            format('Price calculation error: %s', SQLERRM)
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal calculation error',
            'calculation_id', v_calculation_id
        );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_booking_price(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_booking_price(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) TO anon;

-- Add documentation
COMMENT ON FUNCTION public.calculate_booking_price(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) IS 
'Calculates comprehensive booking price including base rate, location fees, taxes, and peak pricing.
Parameters:
- p_car_id: UUID of the car
- p_pickup_date: Pickup date and time
- p_dropoff_date: Dropoff date and time  
- p_pickup_location_id: Optional pickup location for location-based fees
- p_dropoff_location_id: Optional dropoff location for location-based fees
Returns: JSONB with total price and detailed breakdown';

-- ==============================================================================
-- CREATE VALIDATE_BOOKING_PRICE FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_booking_price(
    p_booking_id UUID,
    p_expected_total_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking_record RECORD;
    v_calculated_price JSONB;
    v_calculated_total NUMERIC(10,2);
    v_price_difference NUMERIC(10,2);
    v_tolerance NUMERIC(10,2) := 0.01; -- $0.01 tolerance
    v_validation_id UUID;
    
BEGIN
    -- Initialize tracking
    v_validation_id := gen_random_uuid();
    
    -- Validate inputs
    IF p_booking_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'valid', false,
            'error', 'Booking ID is required',
            'validation_id', v_validation_id
        );
    END IF;
    
    IF p_expected_total_price IS NULL OR p_expected_total_price < 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'valid', false,
            'error', 'Invalid expected price',
            'validation_id', v_validation_id
        );
    END IF;
    
    -- Fetch booking details
    SELECT 
        b.id,
        b.car_id,
        b.start_date,
        b.end_date,
        b.total_price,
        b.status,
        bl_pickup.id as pickup_location_id,
        bl_dropoff.id as dropoff_location_id
    INTO v_booking_record
    FROM public.bookings b
    LEFT JOIN public.booking_locations bl_pickup 
        ON b.id = bl_pickup.booking_id 
        AND bl_pickup.type = 'pickup'::booking_location_type_enum
    LEFT JOIN public.booking_locations bl_dropoff 
        ON b.id = bl_dropoff.booking_id 
        AND bl_dropoff.type = 'dropoff'::booking_location_type_enum
    WHERE b.id = p_booking_id;
    
    IF v_booking_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'valid', false,
            'error', 'Booking not found',
            'validation_id', v_validation_id
        );
    END IF;
    
    -- Prevent validation on already completed or cancelled bookings
    IF v_booking_record.status IN ('completed', 'cancelled') THEN
        RETURN jsonb_build_object(
            'success', false,
            'valid', false,
            'error', format('Cannot validate price for %s booking', v_booking_record.status),
            'validation_id', v_validation_id
        );
    END IF;
    
    -- Recalculate price
    v_calculated_price := public.calculate_booking_price(
        v_booking_record.car_id,
        v_booking_record.start_date::timestamptz,
        v_booking_record.end_date::timestamptz,
        v_booking_record.pickup_location_id,
        v_booking_record.dropoff_location_id
    );
    
    -- Check if calculation was successful
    IF NOT (v_calculated_price->>'success')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'valid', false,
            'error', 'Failed to recalculate price',
            'details', v_calculated_price,
            'validation_id', v_validation_id
        );
    END IF;
    
    v_calculated_total := (v_calculated_price->>'total_price')::numeric;
    v_price_difference := ABS(v_calculated_total - p_expected_total_price);
    
    -- Check if price matches within tolerance
    IF v_price_difference <= v_tolerance THEN
        -- Log successful validation
        INSERT INTO public.booking_events (
            booking_id, event_type, timestamp, actor_type, actor_id,
            details, summary_text
        ) VALUES (
            p_booking_id,
            'price_validated'::public.booking_event_type_enum,
            now(),
            'system'::public.actor_type_enum,
            v_validation_id::TEXT,
            jsonb_build_object(
                'expected_price', p_expected_total_price,
                'calculated_price', v_calculated_total,
                'difference', v_price_difference,
                'validation_result', 'valid'
            ),
            format('Price validated successfully: %s', p_expected_total_price)
        );
        
        RETURN jsonb_build_object(
            'success', true,
            'valid', true,
            'expected_price', p_expected_total_price,
            'calculated_price', v_calculated_total,
            'difference', v_price_difference,
            'validation_id', v_validation_id
        );
    ELSE
        -- Log price mismatch (potential manipulation attempt)
        INSERT INTO public.booking_events (
            booking_id, event_type, timestamp, actor_type, actor_id,
            details, summary_text
        ) VALUES (
            p_booking_id,
            'price_validation_failed'::public.booking_event_type_enum,
            now(),
            'system'::public.actor_type_enum,
            v_validation_id::TEXT,
            jsonb_build_object(
                'expected_price', p_expected_total_price,
                'calculated_price', v_calculated_total,
                'difference', v_price_difference,
                'validation_result', 'mismatch',
                'security_alert', 'Potential price manipulation detected'
            ),
            format('SECURITY: Price mismatch detected. Expected: %s, Calculated: %s', 
                   p_expected_total_price, v_calculated_total)
        );
        
        RETURN jsonb_build_object(
            'success', true,
            'valid', false,
            'error', 'Price mismatch detected',
            'expected_price', p_expected_total_price,
            'calculated_price', v_calculated_total,
            'difference', v_price_difference,
            'validation_id', v_validation_id
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO public.booking_events (
            booking_id, event_type, timestamp, actor_type, actor_id,
            details, summary_text
        ) VALUES (
            COALESCE(p_booking_id, '00000000-0000-0000-0000-000000000000'::uuid),
            'system_error'::public.booking_event_type_enum,
            now(),
            'system'::public.actor_type_enum,
            COALESCE(v_validation_id::TEXT, 'error'),
            jsonb_build_object(
                'function', 'validate_booking_price',
                'error', SQLERRM,
                'sqlstate', SQLSTATE,
                'booking_id', p_booking_id,
                'expected_price', p_expected_total_price
            ),
            format('Price validation error: %s', SQLERRM)
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'valid', false,
            'error', 'Internal validation error',
            'validation_id', v_validation_id
        );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_booking_price(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_booking_price(UUID, NUMERIC) TO anon;

-- Add documentation
COMMENT ON FUNCTION public.validate_booking_price(UUID, NUMERIC) IS 
'Validates booking price to prevent manipulation attempts.
Parameters:
- p_booking_id: UUID of the booking
- p_expected_total_price: The price claimed by the client
Returns: JSONB with validation result and security information';

-- ==============================================================================
-- CREATE PERFORMANCE INDEXES
-- ==============================================================================

-- Index for fast car pricing lookups
CREATE INDEX IF NOT EXISTS idx_car_pricing_lookup 
ON public.car_pricing(car_id) 
WHERE base_price > 0;

-- Index for fast availability checks
CREATE INDEX IF NOT EXISTS idx_car_availability_lookup 
ON public.cars(id) 
WHERE available = true;

-- Index for fee lookups
CREATE INDEX IF NOT EXISTS idx_car_additional_fees_lookup 
ON public.car_additional_fees(car_id, is_optional) 
WHERE amount > 0;

-- Index for booking locations
CREATE INDEX IF NOT EXISTS idx_booking_locations_lookup 
ON public.booking_locations(booking_id, type);

-- Index for booking events audit trail
CREATE INDEX IF NOT EXISTS idx_booking_events_audit 
ON public.booking_events(event_type, timestamp DESC)
WHERE event_type IN ('price_calculated', 'price_validated', 'price_validation_failed');

-- ==============================================================================
-- TEST DATA AND EXAMPLES
-- ==============================================================================

-- Insert sample peak pricing rule (weekend surcharge)
INSERT INTO public.peak_pricing_rules (rule_name, day_of_week, multiplier, is_active)
SELECT 'Weekend Rate', ARRAY[0, 6], 1.15, true
WHERE NOT EXISTS (
    SELECT 1 FROM public.peak_pricing_rules WHERE rule_name = 'Weekend Rate'
);

-- Insert sample location fees
INSERT INTO public.location_fees (location_id, fee_type, fee_amount, description, is_active)
SELECT 
    '11111111-1111-1111-1111-111111111111'::uuid,
    'airport',
    25.00,
    'Airport pickup surcharge',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.location_fees 
    WHERE location_id = '11111111-1111-1111-1111-111111111111'::uuid
      AND fee_type = 'airport'
);

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================

-- Verify functions exist
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('calculate_booking_price', 'validate_booking_price')
ORDER BY p.proname, pg_get_function_arguments(p.oid);

-- ==============================================================================
-- ROLLBACK COMMANDS (commented for safety)
-- ==============================================================================

/*
-- To rollback this migration:
DROP FUNCTION IF EXISTS public.calculate_booking_price(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.validate_booking_price(UUID, NUMERIC) CASCADE;
DROP TABLE IF EXISTS public.tax_configurations CASCADE;
DROP TABLE IF EXISTS public.location_fees CASCADE;
DROP TABLE IF EXISTS public.peak_pricing_rules CASCADE;
DROP INDEX IF EXISTS idx_tax_config_location_active;
DROP INDEX IF EXISTS idx_location_fees_active;
DROP INDEX IF EXISTS idx_peak_pricing_active;
DROP INDEX IF EXISTS idx_car_pricing_lookup;
DROP INDEX IF EXISTS idx_car_availability_lookup;
DROP INDEX IF EXISTS idx_car_additional_fees_lookup;
DROP INDEX IF EXISTS idx_booking_locations_lookup;
DROP INDEX IF EXISTS idx_booking_events_audit;
*/

-- ==============================================================================
-- COMMIT TRANSACTION
-- ==============================================================================

COMMIT;

-- ==============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ==============================================================================

DO $$
DECLARE
    v_calc_exists BOOLEAN;
    v_validate_exists BOOLEAN;
BEGIN
    -- Check if functions exist
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname = 'calculate_booking_price'
          AND pg_get_function_arguments(p.oid) LIKE '%UUID%UUID%'
    ) INTO v_calc_exists;
    
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname = 'validate_booking_price'
    ) INTO v_validate_exists;
    
    IF v_calc_exists AND v_validate_exists THEN
        RAISE NOTICE 'SUCCESS: Both calculate_booking_price and validate_booking_price functions deployed';
        RAISE NOTICE 'Features enabled:';
        RAISE NOTICE '  - Base price calculation with duration';
        RAISE NOTICE '  - Location-based fees (pickup/dropoff)';
        RAISE NOTICE '  - Configurable tax rates';
        RAISE NOTICE '  - Peak/weekend pricing';
        RAISE NOTICE '  - Price validation with manipulation detection';
        RAISE NOTICE '  - Comprehensive audit logging';
    ELSE
        RAISE EXCEPTION 'DEPLOYMENT FAILED: One or more functions not created';
    END IF;
END;
$$;

-- ==============================================================================
-- SAMPLE TEST QUERIES (commented for production)
-- ==============================================================================

/*
-- Test 1: Calculate price without location fees
SELECT public.calculate_booking_price(
    (SELECT id FROM public.cars WHERE available = true LIMIT 1),
    '2025-09-01 10:00:00+00'::timestamptz,
    '2025-09-05 10:00:00+00'::timestamptz
);

-- Test 2: Calculate price with location fees
SELECT public.calculate_booking_price(
    (SELECT id FROM public.cars WHERE available = true LIMIT 1),
    '2025-09-01 10:00:00+00'::timestamptz,
    '2025-09-05 10:00:00+00'::timestamptz,
    '11111111-1111-1111-1111-111111111111'::uuid, -- pickup location
    '22222222-2222-2222-2222-222222222222'::uuid  -- dropoff location
);

-- Test 3: Validate booking price
INSERT INTO public.bookings (customer_id, car_id, start_date, end_date, total_price, status)
VALUES (
    (SELECT id FROM public.customers LIMIT 1),
    (SELECT id FROM public.cars WHERE available = true LIMIT 1),
    '2025-09-01',
    '2025-09-05',
    500.00,
    'pending'
) RETURNING id;

-- Then validate:
SELECT public.validate_booking_price(
    '<booking_id_from_above>'::uuid,
    500.00
);
*/

-- End of migration