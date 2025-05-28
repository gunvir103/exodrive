-- Function to confirm car availability when a booking is confirmed
CREATE OR REPLACE FUNCTION public.fn_confirm_car_availability_after_booking_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
    v_confirmed_statuses public.booking_overall_status_enum[];
BEGIN
    -- Define which statuses are considered "confirmed" for the purpose of this trigger
    v_confirmed_statuses := ARRAY[
        'upcoming'::public.booking_overall_status_enum, 
        'active'::public.booking_overall_status_enum
    ];

    -- Check if the new overall_status is one of the confirmed statuses
    -- AND the old overall_status was not one of these confirmed statuses (i.e., it's a transition into confirmed)
    IF NEW.overall_status = ANY(v_confirmed_statuses) AND 
       OLD.overall_status IS DISTINCT FROM NEW.overall_status AND
       NOT (OLD.overall_status = ANY(v_confirmed_statuses)) THEN

        -- Update car_availability for the dates of this booking from 'pending_confirmation' to 'booked'
        UPDATE public.car_availability
        SET status = 'booked'::public.car_availability_status_enum
        WHERE car_id = NEW.car_id
          AND date >= NEW.start_date
          AND date <= NEW.end_date
          AND booking_id = NEW.id
          AND status = 'pending_confirmation'::public.car_availability_status_enum; -- Only update if it was pending confirmation

        -- Optional: Log an event specifically for car availability being confirmed.
        -- As with the cancellation trigger, this is distinct from the main booking status change event.
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
            NEW.id, 
            'booking_updated', -- Or a more specific custom enum value
            'system',
            'Trigger: fn_confirm_car_availability_after_booking_confirmation',
            'Car availability for booking dates has been confirmed as booked.',
            jsonb_build_object(
                'car_id', NEW.car_id, 
                'start_date', NEW.start_date, 
                'end_date', NEW.end_date,
                'new_overall_status', NEW.overall_status
            )
        );
        */
        
    END IF;
    RETURN NEW; -- For AFTER trigger, return value is ignored
END;
$function$;

-- Trigger to execute the function after a booking is updated
DROP TRIGGER IF EXISTS tg_confirm_car_availability_after_booking_confirmation ON public.bookings;
CREATE TRIGGER tg_confirm_car_availability_after_booking_confirmation
    AFTER UPDATE OF overall_status ON public.bookings -- Only fire if overall_status column is updated
    FOR EACH ROW
    WHEN (OLD.overall_status IS DISTINCT FROM NEW.overall_status) -- Condition to ensure status actually changed
    EXECUTE FUNCTION public.fn_confirm_car_availability_after_booking_confirmation(); 