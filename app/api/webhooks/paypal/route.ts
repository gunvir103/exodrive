import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getPayPalAccessToken } from '@/lib/paypal-client';
import { WebhookRetryService } from '@/lib/services/webhook-retry-service';
import crypto from 'crypto';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per IP per minute
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Replay attack prevention - store processed webhook IDs with timestamps
const processedWebhooks = new Map<string, number>();
const WEBHOOK_ID_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes for timestamp validation

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

// Security logging function
function logSecurityEvent(level: 'info' | 'warn' | 'error', message: string, details: any = {}) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    component: 'paypal-webhook-security',
    ...details
  };
  
  if (level === 'error') {
    console.error('[SECURITY]', JSON.stringify(logData));
  } else if (level === 'warn') {
    console.warn('[SECURITY]', JSON.stringify(logData));
  } else {
    console.info('[SECURITY]', JSON.stringify(logData));
  }
}

// Rate limiting function
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip || 'unknown';
  
  // Clean up old entries
  for (const [cleanupKey, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(cleanupKey);
    }
  }
  
  const existing = rateLimitMap.get(key);
  if (!existing) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  
  if (now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    logSecurityEvent('warn', 'Rate limit exceeded', { ip: key, count: existing.count });
    return false;
  }
  
  existing.count++;
  return true;
}

// Replay attack prevention
function checkReplayAttack(webhookId: string, transmissionTime: string): boolean {
  const now = Date.now();
  
  // Clean up old processed webhooks
  for (const [id, timestamp] of processedWebhooks.entries()) {
    if (now - timestamp > WEBHOOK_ID_TTL_MS) {
      processedWebhooks.delete(id);
    }
  }
  
  // Check if webhook was already processed
  if (processedWebhooks.has(webhookId)) {
    logSecurityEvent('warn', 'Replay attack detected - webhook already processed', { webhookId });
    return false;
  }
  
  // Validate timestamp (within 5 minutes)
  const transmissionTimeMs = parseInt(transmissionTime) * 1000;
  const timeDiff = Math.abs(now - transmissionTimeMs);
  
  if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
    logSecurityEvent('warn', 'Timestamp validation failed', { 
      webhookId, 
      transmissionTime, 
      timeDiff: timeDiff / 1000 + ' seconds' 
    });
    return false;
  }
  
  // Mark as processed
  processedWebhooks.set(webhookId, now);
  return true;
}

// Verify PayPal webhook signature - STRICT SECURITY FOR ALL ENVIRONMENTS
async function verifyPayPalWebhook(
  request: NextRequest,
  rawBody: string
): Promise<boolean> {
  const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';
    
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  // CRITICAL: No environment-based bypasses - webhook ID is REQUIRED
  if (!webhookId) {
    logSecurityEvent('error', 'PAYPAL_WEBHOOK_ID not configured - webhook verification impossible', {});
    return false;
  }

  try {
    const accessToken = await getPayPalAccessToken();
    if (!accessToken) {
      logSecurityEvent('error', 'Failed to obtain PayPal access token', {});
      return false;
    }
    
    // Extract PayPal headers
    const authAlgo = request.headers.get('paypal-auth-algo');
    const certUrl = request.headers.get('paypal-cert-url');
    const transmissionId = request.headers.get('paypal-transmission-id');
    const transmissionSig = request.headers.get('paypal-transmission-sig');
    const transmissionTime = request.headers.get('paypal-transmission-time');
    
    // CRITICAL: All headers are REQUIRED - no environment-based bypasses
    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      logSecurityEvent('error', 'Missing required PayPal webhook headers', {
        authAlgo: authAlgo ? 'present' : 'missing',
        certUrl: certUrl ? 'present' : 'missing',
        transmissionId: transmissionId ? 'present' : 'missing',
        transmissionSig: transmissionSig ? 'present' : 'missing',
        transmissionTime: transmissionTime ? 'present' : 'missing'
      });
      return false;
    }
    
    // Validate certificate URL to prevent SSRF attacks
    if (!certUrl.startsWith('https://api.paypal.com/') && !certUrl.startsWith('https://api.sandbox.paypal.com/')) {
      logSecurityEvent('error', 'Invalid PayPal certificate URL', { certUrl });
      return false;
    }
    
    // Check for replay attacks and timestamp validation
    if (!checkReplayAttack(transmissionId, transmissionTime)) {
      return false;
    }
    
    // Parse webhook data for verification (with error handling)
    let webhookEvent;
    try {
      webhookEvent = JSON.parse(rawBody);
    } catch (parseError) {
      logSecurityEvent('error', 'Invalid JSON in webhook payload', { error: parseError });
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
        webhook_event: webhookEvent
      })
    });

    if (!verificationResponse.ok) {
      const errorBody = await verificationResponse.text();
      logSecurityEvent('error', 'PayPal webhook verification API call failed', {
        status: verificationResponse.status,
        statusText: verificationResponse.statusText,
        error: errorBody
      });
      return false;
    }

    const verificationData = await verificationResponse.json();
    const verificationStatus = verificationData.verification_status;
    
    if (verificationStatus === 'SUCCESS') {
      logSecurityEvent('info', 'PayPal webhook signature verified successfully', {
        transmissionId: transmissionId
      });
      return true;
    } else {
      // CRITICAL: Always fail closed on verification failure - NO environment bypasses
      logSecurityEvent('error', 'PayPal webhook signature verification failed', {
        verificationStatus,
        transmissionId: transmissionId
      });
      return false;
    }
  } catch (error: any) {
    logSecurityEvent('error', 'Error verifying PayPal webhook signature', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let rawBody: string = '';
  let validationResult: any;
  
  try {
    // SECURITY: Extract client information
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const realIp = request.headers.get('x-real-ip') || '';
    const clientIp = forwardedFor.split(',')[0] || realIp || 'unknown';
    
    // SECURITY: Rate limiting
    if (!checkRateLimit(clientIp)) {
      logSecurityEvent('warn', 'Rate limit exceeded', { ip: clientIp, userAgent });
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    
    // SECURITY: Validate User-Agent (PayPal webhooks have specific patterns)
    if (!userAgent.includes('PayPal')) {
      logSecurityEvent('warn', 'Suspicious request - invalid User-Agent', { 
        userAgent, 
        ip: clientIp 
      });
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    
    // SECURITY: Validate request method
    if (request.method !== 'POST') {
      logSecurityEvent('warn', 'Invalid HTTP method', { method: request.method, ip: clientIp });
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }
    
    // SECURITY: Read and validate request body
    rawBody = await request.text();
    
    if (!rawBody || rawBody.length === 0) {
      logSecurityEvent('warn', 'Empty request body', { ip: clientIp });
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // SECURITY: Limit payload size (prevent DoS attacks)
    if (rawBody.length > 1024 * 1024) { // 1MB limit
      logSecurityEvent('warn', 'Request body too large', { size: rawBody.length, ip: clientIp });
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    
    // Initialize services after basic validation
    const supabase = createSupabaseServerClient(request.cookies as any);
    const retryService = new WebhookRetryService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // CRITICAL SECURITY: Verify webhook signature - NO BYPASSES
    const isValid = await verifyPayPalWebhook(request, rawBody);
    if (!isValid) {
      logSecurityEvent('error', 'Webhook signature verification failed', { ip: clientIp });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate JSON payload
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      logSecurityEvent('error', 'Invalid JSON payload', { ip: clientIp, error: parseError });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate webhook payload schema
    validationResult = paypalWebhookSchema.safeParse(body);
    if (!validationResult.success) {
      logSecurityEvent('error', 'Webhook payload validation failed', {
        ip: clientIp,
        errors: validationResult.error.flatten()
      });
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const webhookData = validationResult.data;
    const { event_type, resource } = webhookData;
    
    // Log successful webhook reception
    logSecurityEvent('info', 'Valid webhook received', {
      webhookId: webhookData.id,
      eventType: event_type,
      ip: clientIp
    });

    // SECURITY: Check for idempotency - prevent duplicate processing
    const isProcessed = await retryService.isWebhookProcessed(webhookData.id, 'paypal');
    if (isProcessed) {
      logSecurityEvent('info', 'Webhook already processed (idempotency check)', {
        webhookId: webhookData.id
      });
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
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
        
        // Generate DocuSeal contract after payment capture
        try {
          const { getDocuSealService } = await import('@/lib/services/docuseal-service');
          const docusealService = getDocuSealService();
          const contractResult = await docusealService.generateContract(bookingId);
          
          if (contractResult.success) {
            console.log(`Contract generated for booking ${bookingId}: ${contractResult.submissionId}`);
            eventMetadata.contract_generated = true;
            eventMetadata.contract_submission_id = contractResult.submissionId;
          } else {
            console.error(`Failed to generate contract for booking ${bookingId}:`, contractResult.error);
            // Don't fail the webhook, just log the error
            eventMetadata.contract_generation_error = contractResult.error;
          }
        } catch (contractError: any) {
          console.error(`Error generating contract for booking ${bookingId}:`, contractError);
          eventMetadata.contract_generation_error = contractError.message;
        }

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

    // Log successful processing
    logSecurityEvent('info', 'Webhook processed successfully', {
      webhookId: webhookData.id,
      eventType,
      bookingId,
      processingTime: Date.now() - startTime + 'ms'
    });
    
    return NextResponse.json({ 
      message: 'Webhook processed successfully',
      bookingId,
      eventType 
    });

  } catch (error: any) {
    // Log security-relevant error
    logSecurityEvent('error', 'Webhook processing failed', {
      error: error.message,
      stack: error.stack,
      processingTime: Date.now() - startTime + 'ms'
    });
    
    // SECURITY: Don't retry client errors (4xx) to prevent abuse
    if (error instanceof SyntaxError || validationResult?.success === false) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
    
    // Store failed webhook for retry (only for server errors)
    if (rawBody) {
      try {
        const retryService = new WebhookRetryService(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const webhookData = JSON.parse(rawBody);
        const headers = Object.fromEntries(request.headers.entries());
        
        // Remove sensitive headers from storage
        delete headers['authorization'];
        delete headers['cookie'];
        
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
        
      } catch (storeError) {
        logSecurityEvent('error', 'Failed to store failed webhook for retry', {
          error: storeError.message
        });
      }
    }
    
    // SECURITY: Don't expose internal error details
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
