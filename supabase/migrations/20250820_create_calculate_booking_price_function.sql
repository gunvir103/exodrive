-- Create function to calculate booking price
CREATE OR REPLACE FUNCTION calculate_booking_price(
    p_car_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_price DECIMAL;
    v_deposit_amount DECIMAL;
    v_days INTEGER;
    v_subtotal DECIMAL;
    v_final_price DECIMAL;
    v_car_exists BOOLEAN;
BEGIN
    -- Validate inputs
    IF p_car_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Missing required parameters'
        );
    END IF;

    -- Validate date range
    IF p_start_date > p_end_date THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Start date must be before end date'
        );
    END IF;

    -- Check if car exists
    SELECT EXISTS(SELECT 1 FROM cars WHERE id = p_car_id) INTO v_car_exists;
    
    IF NOT v_car_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Car not found'
        );
    END IF;

    -- Get pricing information
    SELECT 
        base_price,
        deposit_amount
    INTO 
        v_base_price,
        v_deposit_amount
    FROM 
        car_pricing
    WHERE 
        car_id = p_car_id
    LIMIT 1;

    -- Check if pricing exists
    IF v_base_price IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pricing information not found for this car'
        );
    END IF;

    -- Calculate number of days (inclusive)
    v_days := (p_end_date - p_start_date) + 1;
    
    -- Ensure minimum 1 day
    IF v_days < 1 THEN
        v_days := 1;
    END IF;

    -- Calculate prices
    v_subtotal := v_base_price * v_days;
    
    -- For now, final price is just the subtotal (could add taxes/fees later)
    v_final_price := v_subtotal;

    -- If deposit amount is not set, default to 30% of total
    IF v_deposit_amount IS NULL OR v_deposit_amount = 0 THEN
        v_deposit_amount := ROUND(v_final_price * 0.3, 2);
    END IF;

    -- Return successful calculation
    RETURN jsonb_build_object(
        'success', true,
        'base_price', v_base_price,
        'days', v_days,
        'subtotal', v_subtotal,
        'deposit_amount', v_deposit_amount,
        'final_price', v_final_price
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return failure
        RAISE WARNING 'Error in calculate_booking_price: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred while calculating price: ' || SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_booking_price(UUID, DATE, DATE) TO authenticated;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION calculate_booking_price(UUID, DATE, DATE) TO service_role;

-- Grant execute permission to anon for public access (if needed)
GRANT EXECUTE ON FUNCTION calculate_booking_price(UUID, DATE, DATE) TO anon;