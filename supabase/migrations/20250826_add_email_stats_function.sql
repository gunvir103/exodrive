-- Create function to get email statistics
CREATE OR REPLACE FUNCTION public.get_email_stats()
RETURNS TABLE (
  total_bookings BIGINT,
  confirmation_emails_sent BIGINT,
  confirmation_emails_failed BIGINT,
  confirmation_emails_pending BIGINT,
  payment_emails_sent BIGINT,
  payment_emails_failed BIGINT,
  payment_emails_pending BIGINT,
  total_emails_sent BIGINT,
  total_emails_failed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_bookings,
    COUNT(*) FILTER (WHERE email_confirmation_status = 'sent') as confirmation_emails_sent,
    COUNT(*) FILTER (WHERE email_confirmation_status = 'failed') as confirmation_emails_failed,
    COUNT(*) FILTER (WHERE email_confirmation_status = 'pending') as confirmation_emails_pending,
    COUNT(*) FILTER (WHERE email_payment_receipt_status = 'sent') as payment_emails_sent,
    COUNT(*) FILTER (WHERE email_payment_receipt_status = 'failed') as payment_emails_failed,
    COUNT(*) FILTER (WHERE email_payment_receipt_status = 'pending') as payment_emails_pending,
    (
      COUNT(*) FILTER (WHERE email_confirmation_status = 'sent') +
      COUNT(*) FILTER (WHERE email_payment_receipt_status = 'sent')
    ) as total_emails_sent,
    (
      COUNT(*) FILTER (WHERE email_confirmation_status = 'failed') +
      COUNT(*) FILTER (WHERE email_payment_receipt_status = 'failed')
    ) as total_emails_failed
  FROM public.bookings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admin will be verified in the API)
GRANT EXECUTE ON FUNCTION public.get_email_stats() TO authenticated;

COMMENT ON FUNCTION public.get_email_stats() IS 'Returns email statistics for admin dashboard';