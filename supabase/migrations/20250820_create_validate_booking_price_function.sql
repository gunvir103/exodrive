-- Create function to validate booking price against server calculation
-- This function is used to prevent price manipulation by comparing client-provided prices
-- with server-calculated prices to ensure pricing integrity
CREATE OR REPLACE FUNCTION validate_booking_price(
    p_car_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_client_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_server_calculation JSONB;
    v_server_price NUMERIC;
    v_price_difference NUMERIC;
BEGIN
    -- Validate inputs
    IF p_car_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL OR p_client_price IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Missing required parameters for price validation'
        );
    END IF;

    -- Validate client price is positive
    IF p_client_price <= 0 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Invalid price: must be greater than zero'
        );
    END IF;

    -- Get server calculation using the existing function
    v_server_calculation := calculate_booking_price(p_car_id, p_start_date, p_end_date);
    
    -- Check if server calculation was successful
    IF NOT (v_server_calculation->>'success')::boolean THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', v_server_calculation->>'error',
            'details', 'Server price calculation failed'
        );
    END IF;
    
    -- Extract server price
    v_server_price := (v_server_calculation->>'final_price')::numeric;
    
    -- Calculate absolute difference
    v_price_difference := ABS(v_server_price - p_client_price);
    
    -- Allow small floating point differences (0.01 = 1 cent)
    -- This accounts for potential rounding differences between client and server
    IF v_price_difference <= 0.01 THEN
        RETURN jsonb_build_object(
            'valid', true,
            'server_calculation', v_server_calculation,
            'client_price', p_client_price,
            'message', 'Price validation successful'
        );
    ELSE
        -- Log potential price manipulation attempt
        RAISE WARNING 'Price mismatch detected - Car: %, Dates: % to %, Server: %, Client: %, Difference: %',
            p_car_id, p_start_date, p_end_date, v_server_price, p_client_price, v_price_difference;
            
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Price validation failed',
            'details', 'The provided price does not match server calculations',
            'server_price', v_server_price,
            'client_price', p_client_price,
            'difference', v_price_difference
        );
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return failure
        RAISE WARNING 'Error in validate_booking_price: %', SQLERRM;
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'An error occurred during price validation',
            'details', SQLERRM
        );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_booking_price(UUID, DATE, DATE, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_booking_price(UUID, DATE, DATE, NUMERIC) TO service_role;
-- Note: anon role should NOT have access to validation function as it's for internal use

-- Add comment for documentation
COMMENT ON FUNCTION validate_booking_price IS 'Validates client-provided booking prices against server calculations to prevent price manipulation. Returns JSON with validation result and details.';