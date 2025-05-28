CREATE OR REPLACE FUNCTION clear_car_availability_hold(
    p_booking_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.car_availability
    SET status = 'available', booking_id = NULL, updated_at = now()
    WHERE booking_id = p_booking_id AND status = 'pending_payment_confirmation';

    -- Optionally, log that this rollback occurred if you have an audit log
    -- For example: INSERT INTO audit_log (action, details) VALUES ('availability_hold_cleared', jsonb_build_object('booking_id', p_booking_id));
END;
$$ LANGUAGE plpgsql