-- Function to free car availability when a booking is cancelled
CREATE OR REPLACE FUNCTION public.fn_free_car_availability_after_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Check if the booking is actually being cancelled
    IF NEW.overall_status = 'cancelled'::public.booking_overall_status_enum AND 
       OLD.overall_status IS DISTINCT FROM 'cancelled'::public.booking_overall_status_enum THEN

        -- Update car_availability for the dates of this booking
        UPDATE public.car_availability
        SET 
            status = 'available'::public.car_availability_status_enum,
            booking_id = NULL -- Remove the link to this cancelled booking
        WHERE car_id = OLD.car_id -- Use OLD.car_id in case it could change, though unlikely for cancellations
          AND date >= OLD.start_date
          AND date <= OLD.end_date
          AND booking_id = OLD.id; -- Make sure we only update slots held by this specific booking
        
        -- Optional: Log an event specifically for car availability being freed, if needed.
        -- This is distinct from the booking cancellation event itself.
        -- For now, we assume the primary cancellation event is logged by update_booking_status_and_log_event.
        -- Example if specific logging for this action is desired:
        /*
        INSERT INTO public.booking_events (
            booking_id,
            event_type,
            actor_type,
            actor_name,
            summary_text,
            details
        )
        VALUES (
            OLD.id, 
            'booking_updated', -- Or a more specific custom enum value if created
            'system',
            'Trigger: fn_free_car_availability_after_cancel',
            'Car availability for booking dates has been reset to available due to cancellation.',
            jsonb_build_object('car_id', OLD.car_id, 'start_date', OLD.start_date, 'end_date', OLD.end_date)
        );
        */

    END IF;
    RETURN NEW; -- For AFTER trigger, return value is ignored, but good practice
END;
$function$;

-- Trigger to execute the function after a booking is updated
DROP TRIGGER IF EXISTS tg_free_car_availability_after_cancel ON public.bookings;
CREATE TRIGGER tg_free_car_availability_after_cancel
    AFTER UPDATE OF overall_status ON public.bookings -- Only fire if overall_status column is updated
    FOR EACH ROW
    WHEN (OLD.overall_status IS DISTINCT FROM NEW.overall_status) -- Condition to ensure status actually changed
    EXECUTE FUNCTION public.fn_free_car_availability_after_cancel(); 