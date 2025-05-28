CREATE OR REPLACE FUNCTION public.update_booking_status_and_log_event(
    p_booking_id UUID,
    p_new_overall_status TEXT DEFAULT NULL, -- Pass as text, cast to enum inside
    p_new_payment_status TEXT DEFAULT NULL,
    p_new_contract_status TEXT DEFAULT NULL,
    p_actor_type public.actor_type_enum DEFAULT 'system',
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_event_details JSONB DEFAULT NULL,
    p_event_summary TEXT DEFAULT NULL
)
RETURNS BOOLEAN -- Returns true on success, false on failure
LANGUAGE plpgsql
AS $function$
DECLARE
    v_old_overall_status public.booking_overall_status_enum;
    v_old_payment_status public.payment_status_enum;
    v_old_contract_status public.contract_status_enum;
    v_new_overall_status_enum public.booking_overall_status_enum;
    v_new_payment_status_enum public.payment_status_enum;
    v_new_contract_status_enum public.contract_status_enum;
    v_event_type public.booking_event_type_enum;
    v_summary TEXT;
    v_final_details JSONB;
BEGIN
    SET search_path = '';

    -- Fetch current statuses
    SELECT 
        overall_status, payment_status, contract_status 
    INTO 
        v_old_overall_status, v_old_payment_status, v_old_contract_status 
    FROM public.bookings 
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE WARNING 'Booking not found: %', p_booking_id;
        RETURN FALSE;
    END IF;

    -- Cast new statuses from text to their respective enums if provided
    IF p_new_overall_status IS NOT NULL THEN
        BEGIN
            v_new_overall_status_enum := p_new_overall_status::public.booking_overall_status_enum;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE WARNING 'Invalid overall_status value: % for booking %', p_new_overall_status, p_booking_id;
                RETURN FALSE;
        END;
    ELSE
        v_new_overall_status_enum := v_old_overall_status; -- Keep old if not provided
    END IF;

    IF p_new_payment_status IS NOT NULL THEN
        BEGIN
            v_new_payment_status_enum := p_new_payment_status::public.payment_status_enum;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE WARNING 'Invalid payment_status value: % for booking %', p_new_payment_status, p_booking_id;
                RETURN FALSE;
        END;
    ELSE
        v_new_payment_status_enum := v_old_payment_status; -- Keep old if not provided
    END IF;

    IF p_new_contract_status IS NOT NULL THEN
        BEGIN
            v_new_contract_status_enum := p_new_contract_status::public.contract_status_enum;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE WARNING 'Invalid contract_status value: % for booking %', p_new_contract_status, p_booking_id;
                RETURN FALSE;
        END;
    ELSE
        v_new_contract_status_enum := v_old_contract_status; -- Keep old if not provided
    END IF;

    -- Update the booking record
    UPDATE public.bookings
    SET 
        overall_status = v_new_overall_status_enum,
        payment_status = v_new_payment_status_enum,
        contract_status = v_new_contract_status_enum,
        updated_at = now()
    WHERE id = p_booking_id;

    -- Determine event type and summary based on what changed
    -- This logic can be expanded for more specific event types
    v_summary := COALESCE(p_event_summary, '');
    v_final_details := COALESCE(p_event_details, '{}'::jsonb);

    IF v_new_overall_status_enum IS DISTINCT FROM v_old_overall_status THEN
        v_event_type := 'status_changed_overall'::public.booking_event_type_enum;
        v_summary := v_summary || 'Overall status changed from ' || COALESCE(v_old_overall_status::text, 'NULL') || ' to ' || COALESCE(v_new_overall_status_enum::text, 'NULL') || '. ';
        v_final_details := v_final_details || jsonb_build_object('old_overall_status', v_old_overall_status, 'new_overall_status', v_new_overall_status_enum);
    END IF;

    IF v_new_payment_status_enum IS DISTINCT FROM v_old_payment_status THEN
        v_event_type := 'status_changed_payment'::public.booking_event_type_enum; -- Could overwrite if overall also changed, refine if needed
        v_summary := v_summary || 'Payment status changed from ' || COALESCE(v_old_payment_status::text, 'NULL') || ' to ' || COALESCE(v_new_payment_status_enum::text, 'NULL') || '. ';
        v_final_details := v_final_details || jsonb_build_object('old_payment_status', v_old_payment_status, 'new_payment_status', v_new_payment_status_enum);
    END IF;

    IF v_new_contract_status_enum IS DISTINCT FROM v_old_contract_status THEN
        v_event_type := 'status_changed_contract'::public.booking_event_type_enum; -- Could overwrite, refine if needed
        v_summary := v_summary || 'Contract status changed from ' || COALESCE(v_old_contract_status::text, 'NULL') || ' to ' || COALESCE(v_new_contract_status_enum::text, 'NULL') || '. ';
        v_final_details := v_final_details || jsonb_build_object('old_contract_status', v_old_contract_status, 'new_contract_status', v_new_contract_status_enum);
    END IF;

    -- If no specific status change event type was set, but an update occurred, use a general update event.
    IF v_event_type IS NULL AND (
        v_new_overall_status_enum IS DISTINCT FROM v_old_overall_status OR 
        v_new_payment_status_enum IS DISTINCT FROM v_old_payment_status OR 
        v_new_contract_status_enum IS DISTINCT FROM v_old_contract_status
    ) THEN
        v_event_type := 'booking_updated'::public.booking_event_type_enum;
        IF v_summary = '' THEN v_summary := 'Booking details updated.'; END IF;
    END IF;

    -- Log the event if an event type was determined (i.e., something changed or manual event passed)
    -- Or if p_event_summary was provided (implying a custom event log is desired)
    IF v_event_type IS NOT NULL OR p_event_summary IS NOT NULL THEN
        INSERT INTO public.booking_events (
            booking_id,
            event_type,
            actor_type,
            actor_id,
            actor_name,
            details,
            summary_text
        )
        VALUES (
            p_booking_id,
            COALESCE(v_event_type, 'admin_note_added'::public.booking_event_type_enum), -- Default to note if only summary provided
            p_actor_type,
            p_actor_id,
            p_actor_name,
            v_final_details,
            TRIM(v_summary)
        );
    END IF;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in update_booking_status_and_log_event for booking %: %', p_booking_id, SQLERRM;
        RETURN FALSE;
END;
$function$; 