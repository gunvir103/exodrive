CREATE OR REPLACE FUNCTION public.create_booking_transactional(
    p_car_id uuid, 
    p_start_date date, 
    p_end_date date, 
    p_customer_first_name text, 
    p_customer_last_name text, 
    p_customer_email text, 
    p_customer_phone text, 
    p_total_price numeric, 
    p_currency text, 
    p_security_deposit_amount numeric, 
    p_secure_token_value text, 
    p_token_expires_at timestamp with time zone, 
    p_booking_days integer, 
    p_initial_overall_status text, 
    p_initial_payment_status text, 
    p_initial_contract_status text
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_customer_id UUID;
    v_secure_token_id UUID;
    v_booking_id UUID;
    v_current_date DATE;
    v_conflicting_dates DATE[];
    v_overall_status public.booking_overall_status_enum;
    v_payment_status public.payment_status_enum;
    v_contract_status public.contract_status_enum;
    v_availability_status public.car_availability_status_enum;
    v_event_details JSONB;
BEGIN
    SET search_path = '';

    BEGIN
        v_overall_status := p_initial_overall_status::public.booking_overall_status_enum;
        v_payment_status := p_initial_payment_status::public.payment_status_enum;
        v_contract_status := p_initial_contract_status::public.contract_status_enum;
        v_availability_status := 'pending_confirmation'::public.car_availability_status_enum;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'invalid_status_value', 
                'details', 'One of the provided status values is not valid for its enum type. Provided: overall=' || 
                           COALESCE(p_initial_overall_status, 'NULL') || ', payment=' || 
                           COALESCE(p_initial_payment_status, 'NULL') || ', contract=' || 
                           COALESCE(p_initial_contract_status, 'NULL')
            );
    END;

    SELECT array_agg(ca.date)
    INTO v_conflicting_dates
    FROM public.car_availability ca
    WHERE ca.car_id = p_car_id
      AND ca.date >= p_start_date
      AND ca.date <= p_end_date
      AND ca.status IN (
          'pending_confirmation'::public.car_availability_status_enum, 
          'booked'::public.car_availability_status_enum, 
          'maintenance'::public.car_availability_status_enum
      );

    IF array_length(v_conflicting_dates, 1) > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'dates_unavailable', 'unavailableDates', v_conflicting_dates);
    END IF;

    SELECT id INTO v_customer_id FROM public.customers WHERE email = p_customer_email;

    IF NOT FOUND THEN
        INSERT INTO public.customers (first_name, last_name, email, phone)
        VALUES (p_customer_first_name, p_customer_last_name, p_customer_email, p_customer_phone)
        RETURNING id INTO v_customer_id;
    END IF;

    INSERT INTO public.booking_secure_tokens (token, expires_at, booking_id)
    VALUES (p_secure_token_value, p_token_expires_at, NULL) 
    RETURNING id INTO v_secure_token_id;

    INSERT INTO public.bookings (
        car_id, customer_id, start_date, end_date, 
        overall_status, payment_status, contract_status, 
        total_price, currency, security_deposit_amount, 
        secure_token_id, notes
    )
    VALUES (
        p_car_id, v_customer_id, p_start_date, p_end_date,
        v_overall_status, v_payment_status, v_contract_status,
        p_total_price, p_currency, p_security_deposit_amount,
        v_secure_token_id, 
        'Booking created. Days: ' || p_booking_days::TEXT -- Note updated slightly
    )
    RETURNING id INTO v_booking_id;

    UPDATE public.booking_secure_tokens
    SET booking_id = v_booking_id
    WHERE id = v_secure_token_id;

    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
        INSERT INTO public.car_availability (car_id, date, status, booking_id)
        VALUES (p_car_id, v_current_date, v_availability_status, v_booking_id)
        ON CONFLICT (car_id, date) DO UPDATE
        SET status = EXCLUDED.status, booking_id = EXCLUDED.booking_id;
        
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;

    -- Log event to booking_events
    v_event_details := jsonb_build_object(
        'carId', p_car_id,
        'startDate', p_start_date,
        'endDate', p_end_date,
        'customerDetails', jsonb_build_object(
            'firstName', p_customer_first_name,
            'lastName', p_customer_last_name,
            'email', p_customer_email,
            'phone', p_customer_phone
        ),
        'totalPrice', p_total_price,
        'currency', p_currency,
        'securityDepositAmount', p_security_deposit_amount,
        'bookingDays', p_booking_days,
        'initialOverallStatus', p_initial_overall_status,
        'initialPaymentStatus', p_initial_payment_status,
        'initialContractStatus', p_initial_contract_status,
        'secureTokenValue', p_secure_token_value -- For audit, though not strictly for display
    );

    INSERT INTO public.booking_events (
        booking_id,
        event_type,
        actor_type,
        actor_name,
        details,
        summary_text
    )
    VALUES (
        v_booking_id,
        'booking_created'::public.booking_event_type_enum,
        'system'::public.actor_type_enum,
        'Edge Function: create-booking-transaction',
        v_event_details,
        'Booking successfully created via Edge Function.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', v_booking_id,
        'customerId', v_customer_id,
        'secureTokenId', v_secure_token_id
    );

EXCEPTION
    WHEN invalid_text_representation THEN
        -- This specific exception handler is redefined here to ensure it's caught before OTHERS
        -- if it occurs during the main body's enum casts (though already handled at the top for params).
        -- The COALESCE in the initial block should handle p_initial_* status values being NULL if allowed by TS.
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'invalid_status_value_conversion', 
            'details', SQLERRM
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'transaction_failed', 'details', SQLERRM);
END;
$function$; 