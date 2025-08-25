CREATE TABLE public.inbox_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resend_email_id TEXT NOT NULL,
    last_event_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_event_at TIMESTAMPTZ DEFAULT now(),
    recipient_email TEXT,
    sender_email TEXT,
    subject TEXT,
    booking_id UUID,
    tags JSONB,
    bounce_type TEXT,
    bounce_description TEXT,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    raw_payload JSONB
);

CREATE INDEX idx_inbox_emails_resend_email_id ON public.inbox_emails(resend_email_id);
CREATE INDEX idx_inbox_emails_booking_id ON public.inbox_emails(booking_id);
CREATE INDEX idx_inbox_emails_last_event_at ON public.inbox_emails(last_event_at);
CREATE INDEX idx_inbox_emails_recipient_email ON public.inbox_emails(recipient_email);

COMMENT ON TABLE public.inbox_emails IS 'Stores status and details of emails sent via Resend, tracked by webhooks.';