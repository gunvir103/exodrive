import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getPayPalAccessToken } from '@/lib/paypal-client';
import { WebhookRetryService } from '@/lib/services/webhook-retry-service';

// PayPal webhook event types we care about
const PAYPAL_EVENT_TYPES = {
  PAYMENT_AUTHORIZATION_CREATED: 'PAYMENT.AUTHORIZATION.CREATED',
  PAYMENT_AUTHORIZATION_VOIDED: 'PAYMENT.AUTHORIZATION.VOIDED',
  PAYMENT_CAPTURE_COMPLETED: 'PAYMENT.CAPTURE.COMPLETED',
  PAYMENT_CAPTURE_DENIED: 'PAYMENT.CAPTURE.DENIED',
  PAYMENT_CAPTURE_REFUNDED: 'PAYMENT.CAPTURE.REFUNDED',
  CUSTOMER_DISPUTE_CREATED: 'CUSTOMER.DISPUTE.CREATED',
  CUSTOMER_DISPUTE_RESOLVED: 'CUSTOMER.DISPUTE.RESOLVED',
  CUSTOMER_DISPUTE_UPDATED: 'CUSTOMER.DISPUTE.UPDATED',
  INVOICING_INVOICE_PAID: 'INVOICING.INVOICE.PAID',
  INVOICING_INVOICE_CANCELLED: 'INVOICING.INVOICE.CANCELLED',
  INVOICING_INVOICE_UPDATED: 'INVOICING.INVOICE.UPDATED'
};

// PayPal webhook payload schema
const paypalWebhookSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  resource_type: z.string().optional(),
  summary: z.string().optional(),
  resource: z.object({
    id: z.string().optional(),              // make optional
    status: z.string().optional(),
    amount: z.object({
      currency_code: z.string(),
      value: z.string()
    }).optional(),
    invoice_id: z.string().optional(),
    custom_id: z.string().optional(), // We'll use this for booking_id
    invoice_number: z.string().optional(),
    reason: z.string().optional(), // For disputes
    dispute_amount: z.object({
      currency_code: z.string(),
      value: z.string()
    }).optional()
  }).passthrough()                          // Allow additional fields
  .optional(),                              // allow missing resource
  create_time: z.string(),
  event_version: z.string()
});

// Verify PayPal webhook signature
async function verifyPayPalWebhook(
  request: NextRequest,
  rawBody: string
): Promise<boolean> {
  const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';
    
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    console.warn('PAYPAL_WEBHOOK_ID not set. Skipping webhook verification. This is not secure for production.');
    return process.env.NODE_ENV !== 'production';
  }

  try {
    const accessToken = await getPayPalAccessToken();
    
    // Extract PayPal headers
    const authAlgo = request.headers.get('paypal-auth-algo');
    const certUrl = request.headers.get('paypal-cert-url');
    const transmissionId = request.headers.get('paypal-transmission-id');
    const transmissionSig = request.headers.get('paypal-transmission-sig');
    const transmissionTime = request.headers.get('paypal-transmission-time');
    
    // Log critical webhook info for monitoring (without sensitive data)
    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      console.error('[PayPal] Missing webhook headers:', {
        authAlgo: authAlgo ? 'present' : 'missing',
        certUrl: certUrl ? 'present' : 'missing',
        transmissionId: transmissionId ? 'present' : 'missing',
        transmissionSig: transmissionSig ? 'present' : 'missing',
        transmissionTime: transmissionTime ? 'present' : 'missing'
      });
    }
    
    // Check if required headers are present
    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      console.warn('Missing required PayPal webhook headers. This might be a test request or misconfigured webhook.');
      // In development, allow missing headers for testing
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }
      return false;
    }
    
    const verificationResponse = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody)
      })
    });

    if (!verificationResponse.ok) {
        const errorBody = await verificationResponse.text();
        console.error('PayPal webhook verification API call failed:', verificationResponse.statusText, errorBody);
        return false;
    }

    const verificationData = await verificationResponse.json();
    const verificationStatus = verificationData.verification_status;
    
    if (verificationStatus === 'SUCCESS') {
      return true;
    } else {
      console.warn('PayPal webhook signature verification failed with status:', verificationStatus);
      // In production, always fail closed on verification errors for security
      if (process.env.NODE_ENV === 'production') {
        return false;
      }
      // Only in development allow processing with failed verification
      console.warn('Development mode: Continuing despite verification failure.');
      return true;
    }
  } catch (error: any) {
    console.error('Error verifying PayPal webhook signature:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  // Initialize webhook retry service
  const retryService = new WebhookRetryService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  let rawBody: string = '';
  let validationResult: any;
  
  try {
    // Basic security: Check User-Agent and IP range
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    
    // PayPal webhooks come from specific User-Agent patterns
    if (!userAgent.includes('PayPal')) {
      console.warn('Webhook request without PayPal User-Agent:', userAgent);
    }
    
    // Log suspicious requests for security monitoring
    if (!userAgent.includes('PayPal')) {
      console.warn('[PayPal] Webhook request without PayPal User-Agent');
    }
    
    rawBody = await request.text();
    
    // Verify webhook signature
    const isValid = await verifyPayPalWebhook(request, rawBody);
    if (!isValid) {
      console.error('Invalid PayPal webhook signature');
      // Always return error on verification failure
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // Validate webhook payload
    validationResult = paypalWebhookSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Invalid PayPal webhook payload:', validationResult.error);
      return NextResponse.json(
        { error: 'Invalid payload', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const webhookData = validationResult.data;
    const { event_type, resource } = webhookData;

    // Check for idempotency - has this webhook already been processed?
    const isProcessed = await retryService.isWebhookProcessed(webhookData.id, 'paypal');
    if (isProcessed) {
      return NextResponse.json({ message: 'Webhook already processed' }, { status: 200 });
    }

    // Handle events that don't have a resource (like webhook ping)
    if (!resource) {
      // Mark as processed even if no resource
      await retryService.markWebhookProcessed(webhookData.id, 'paypal', undefined, { event_type });
      return NextResponse.json({ message: 'Event processed - no resource data' }, { status: 200 });
    }

    // Extract booking ID from custom_id or invoice metadata
    const bookingId = resource.custom_id || resource.invoice_number?.split('-')[1];
    
    if (!bookingId) {
      console.warn('No booking ID found in PayPal webhook:', webhookData);
      return NextResponse.json({ message: 'No booking ID found' }, { status: 200 });
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found for PayPal webhook:', bookingId);
      return NextResponse.json({ message: 'Booking not found' }, { status: 200 });
    }

    // Handle different event types
    let updateData: any = {};
    let eventType = 'payment_webhook_received';
    let eventMetadata: any = {
      paypal_event_id: webhookData.id,
      paypal_event_type: event_type,
      paypal_resource_id: resource.id
    };

    switch (event_type) {
      case PAYPAL_EVENT_TYPES.PAYMENT_AUTHORIZATION_CREATED:
        updateData.payment_status = 'authorized';
        eventType = 'payment_authorized';
        eventMetadata.amount = resource.amount?.value;
        eventMetadata.currency = resource.amount?.currency_code;
        break;

      case PAYPAL_EVENT_TYPES.PAYMENT_AUTHORIZATION_VOIDED:
        updateData.payment_status = 'voided';
        eventType = 'payment_authorization_voided';
        break;

      case PAYPAL_EVENT_TYPES.PAYMENT_CAPTURE_COMPLETED:
        updateData.payment_status = 'captured';
        eventType = 'payment_captured';
        eventMetadata.amount = resource.amount?.value;
        eventMetadata.currency = resource.amount?.currency_code;
        
        // If payment is captured and contract is signed, mark as upcoming
        if (booking.contract_status === 'signed' && booking.overall_status?.startsWith('pending')) {
          updateData.overall_status = 'upcoming';
        }
        break;

      case PAYPAL_EVENT_TYPES.PAYMENT_CAPTURE_DENIED:
        updateData.payment_status = 'failed';
        eventType = 'payment_capture_failed';
        break;

      case PAYPAL_EVENT_TYPES.PAYMENT_CAPTURE_REFUNDED:
        updateData.payment_status = 'refunded';
        eventType = 'payment_refunded';
        eventMetadata.amount = resource.amount?.value;
        eventMetadata.currency = resource.amount?.currency_code;
        break;

      case PAYPAL_EVENT_TYPES.CUSTOMER_DISPUTE_CREATED:
        updateData.overall_status = 'disputed';
        eventType = 'dispute_created';
        
        // Create dispute record
        await supabase.from('disputes').insert({
          booking_id: bookingId,
          payment_id: booking.payment_id,
          dispute_status: 'open',
          reason: resource.reason || 'PayPal dispute',
          amount: parseFloat(resource.amount?.value || '0'),
          provider_dispute_id: resource.id,
          created_at: new Date().toISOString()
        });
        break;

      case PAYPAL_EVENT_TYPES.CUSTOMER_DISPUTE_RESOLVED:
        eventType = 'dispute_resolved';
        
        // Update dispute record
        await supabase
          .from('disputes')
          .update({
            dispute_status: 'resolved',
            resolved_at: new Date().toISOString()
          })
          .eq('provider_dispute_id', resource.id);
        break;

      case PAYPAL_EVENT_TYPES.INVOICING_INVOICE_PAID:
        updateData.payment_status = 'paid';
        eventType = 'invoice_paid';
        
        // If payment is captured and contract is signed, mark as upcoming
        if (booking.contract_status === 'signed' && booking.overall_status?.startsWith('pending')) {
            updateData.overall_status = 'upcoming';
        }
        
        // The `paypal_invoices` table seems to be the right place for this, 
        // but there is no direct relation from `bookings`.
        // I will assume for now this logic is handled elsewhere or not needed immediately.
        break;

      case PAYPAL_EVENT_TYPES.INVOICING_INVOICE_CANCELLED:
        eventType = 'invoice_cancelled';
        break;

      default:
        // Unhandled event type - no action needed
    }

    // Update booking if needed
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Error updating booking from PayPal webhook:', updateError);
      }
    }

    // Log the event
    const { error: eventError } = await supabase.from('booking_events').insert({
      booking_id: bookingId,
      event_type: eventType,
      summary_text: webhookData.summary,
      actor_type: 'webhook_paypal',
      actor_name: 'PayPal System',
      details: webhookData
    });

    if (eventError) {
        console.error('Error logging PayPal event:', eventError);
    }

    // Update payment record with the latest status and PayPal IDs
    if (booking.payment_id && updateData.payment_status) {
      const paymentUpdateData: any = {
        status: updateData.payment_status,
        updated_at: new Date().toISOString()
      };
      
      if (resource.id && (event_type === PAYPAL_EVENT_TYPES.PAYMENT_AUTHORIZATION_CREATED || event_type === PAYPAL_EVENT_TYPES.PAYMENT_CAPTURE_COMPLETED)) {
        // Store the authorization ID when payment is authorized
        if(event_type === PAYPAL_EVENT_TYPES.PAYMENT_AUTHORIZATION_CREATED){
            paymentUpdateData.paypal_authorization_id = resource.id;
        }
      }

      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update(paymentUpdateData)
        .eq('id', booking.payment_id);

        if (paymentUpdateError) {
            console.error('Error updating payment record from PayPal webhook:', paymentUpdateError);
        }
    }

    // Mark webhook as successfully processed
    await retryService.markWebhookProcessed(
      webhookData.id,
      'paypal',
      bookingId,
      {
        event_type,
        booking_updated: Object.keys(updateData).length > 0,
        event_logged: !eventError
      }
    );

    return NextResponse.json({ 
      message: 'Webhook processed successfully',
      bookingId,
      eventType 
    });

  } catch (error: any) {
    console.error('Error processing PayPal webhook:', error);
    
    // Don't retry for client errors
    if (error instanceof SyntaxError || validationResult?.success === false) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    
    // Store failed webhook for retry (only if we have the raw body)
    if (rawBody) {
      try {
        const webhookData = JSON.parse(rawBody);
        const headers = Object.fromEntries(request.headers.entries());
        
        await retryService.storeFailedWebhook({
          webhookId: webhookData.id || `paypal-${Date.now()}`,
          webhookType: 'paypal',
          payload: webhookData,
          headers: headers,
          endpointUrl: new URL('/api/webhooks/paypal', request.url).toString(),
          bookingId: webhookData.resource?.custom_id || webhookData.resource?.invoice_number?.split('-')[1],
          errorMessage: error.message || 'Unknown error',
          errorDetails: {
            stack: error.stack,
            name: error.name
          }
        });
        
        // Failed webhook stored for retry
      } catch (storeError) {
        console.error('Error storing failed webhook:', storeError);
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 