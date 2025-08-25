CREATE OR REPLACE FUNCTION check_and_reserve_car_availability(
    p_car_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_booking_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    loop_date DATE;
    availability_record RECORD;
BEGIN
    FOR loop_date IN SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date LOOP
        -- Check existing availability for the loop_date and p_car_id
        SELECT *
        INTO availability_record
        FROM public.car_availability ca
        WHERE ca.car_id = p_car_id AND ca.date = loop_date;

        IF FOUND THEN
            -- Record exists, check its status
            IF availability_record.status <> 'available' AND availability_record.booking_id IS DISTINCT FROM p_booking_id THEN
                -- Date is not available (booked by someone else or maintenance)
                RAISE WARNING 'Date % for car % is not available. Status: %, Booking ID: %', loop_date, p_car_id, availability_record.status, availability_record.booking_id;
                RETURN FALSE; -- Car not available on this date
            ELSE
                -- Date is available or already booked by the same p_booking_id (idempotency)
                -- Update it to 'pending_payment_confirmation' and link to this booking_id
                UPDATE public.car_availability
                SET status = 'pending_payment_confirmation', booking_id = p_booking_id, updated_at = now()
                WHERE id = availability_record.id;
            END IF;
        ELSE
            -- No record exists, means it's available. Insert a new one.
            INSERT INTO public.car_availability (car_id, date, status, booking_id)
            VALUES (p_car_id, loop_date, 'pending_payment_confirmation', p_booking_id);
        END IF;
    END LOOP;

    RETURN TRUE; -- All dates in the range were successfully reserved

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return false
        RAISE WARNING 'Error in check_and_reserve_car_availability: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql