import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per IP per minute
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Replay attack prevention - store processed webhook IDs with timestamps
const processedWebhooks = new Map<string, number>();
const WEBHOOK_ID_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes for timestamp validation

// Resend webhook event types
const RESEND_EVENT_TYPES = {
  EMAIL_SENT: 'email.sent',
  EMAIL_DELIVERED: 'email.delivered',
  EMAIL_DELIVERY_FAILED: 'email.delivery_failed',
  EMAIL_OPENED: 'email.opened',
  EMAIL_CLICKED: 'email.clicked',
  EMAIL_BOUNCED: 'email.bounced',
  EMAIL_COMPLAINED: 'email.complained'
};

// Security logging function
function logSecurityEvent(level: 'info' | 'warn' | 'error', message: string, details: any = {}) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    component: 'resend-webhook-security',
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
function checkReplayAttack(webhookId: string, createdAt: string): boolean {
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
  const createdAtMs = new Date(createdAt).getTime();
  if (isNaN(createdAtMs)) {
    logSecurityEvent('warn', 'Invalid timestamp format', { webhookId, createdAt });
    return false;
  }
  
  const timeDiff = Math.abs(now - createdAtMs);
  
  if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
    logSecurityEvent('warn', 'Timestamp validation failed', { 
      webhookId, 
      createdAt, 
      timeDiff: timeDiff / 1000 + ' seconds' 
    });
    return false;
  }
  
  // Mark as processed
  processedWebhooks.set(webhookId, now);
  return true;
}

// Resend webhook payload schema
const resendWebhookSchema = z.object({
  type: z.string(),
  created_at: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string().email(),
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string(),
    created_at: z.string(),
    delivered_at: z.string().optional(),
    opened_at: z.string().optional(),
    clicked_at: z.string().optional(),
    bounced_at: z.string().optional(),
    complained_at: z.string().optional(),
    tags: z.object({
      booking_id: z.string().optional(),
      email_type: z.string().optional()
    }).optional(),
    click: z.object({
      link: z.string(),
      timestamp: z.string()
    }).optional(),
    bounce: z.object({
      type: z.enum(['hard', 'soft']),
      message: z.string()
    }).optional()
  })
});

// Verify Resend webhook signature - STRICT SECURITY FOR ALL ENVIRONMENTS
function verifyResendWebhook(
  request: NextRequest,
  body: string
): boolean {
  const signature = request.headers.get('resend-signature');
  if (!signature) {
    logSecurityEvent('error', 'Missing Resend signature header', {});
    return false;
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  // CRITICAL: No environment-based bypasses - webhook secret is REQUIRED
  if (!secret) {
    logSecurityEvent('error', 'RESEND_WEBHOOK_SECRET not configured - webhook verification impossible', {});
    return false;
  }

  try {
    // Resend uses HMAC-SHA256 for webhook signatures
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
    
    if (isValid) {
      logSecurityEvent('info', 'Resend webhook signature verified successfully', {});
      return true;
    } else {
      // CRITICAL: Always fail closed on verification failure - NO environment bypasses
      logSecurityEvent('error', 'Resend webhook signature verification failed', {
        providedSignature: signature.substring(0, 20) + '...', // Log partial signature for debugging
        expectedSignature: expectedSignature.substring(0, 20) + '...'
      });
      return false;
    }
  } catch (error: any) {
    logSecurityEvent('error', 'Error verifying Resend webhook signature', {
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
    
    // SECURITY: Validate User-Agent (Resend webhooks have specific patterns)
    if (!userAgent.toLowerCase().includes('resend') && !userAgent.toLowerCase().includes('webhook')) {
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
    
    // CRITICAL SECURITY: Verify webhook signature - NO BYPASSES
    const isValid = verifyResendWebhook(request, rawBody);
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
    validationResult = resendWebhookSchema.safeParse(body);
    if (!validationResult.success) {
      logSecurityEvent('error', 'Webhook payload validation failed', {
        ip: clientIp,
        errors: validationResult.error.flatten()
      });
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const webhookData = validationResult.data;
    const { type, data, created_at } = webhookData;
    
    // Generate webhook ID for replay attack prevention (Resend doesn't provide one)
    const webhookId = crypto.createHash('sha256').update(rawBody + created_at).digest('hex');
    
    // Log successful webhook reception
    logSecurityEvent('info', 'Valid webhook received', {
      webhookId: webhookId.substring(0, 16) + '...',
      eventType: type,
      ip: clientIp
    });
    
    // SECURITY: Check for replay attacks and timestamp validation
    if (!checkReplayAttack(webhookId, created_at)) {
      return NextResponse.json({ error: 'Replay attack detected or invalid timestamp' }, { status: 400 });
    }

    // Extract booking ID from tags
    const bookingId = data.tags?.booking_id;
    const emailType = data.tags?.email_type || 'unknown';
    
    if (!bookingId) {
      console.warn('No booking ID found in Resend webhook:', webhookData);
      // Still log to inbox_emails table if available
      await logEmailEvent(supabase, webhookData);
      return NextResponse.json({ message: 'No booking ID found' }, { status: 200 });
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, customer_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found for Resend webhook:', bookingId);
      // Still log to inbox_emails table
      await logEmailEvent(supabase, webhookData);
      return NextResponse.json({ message: 'Booking not found' }, { status: 200 });
    }

    // Handle different event types
    let eventType = 'email_status_update';
    let eventMetadata: any = {
      resend_event_type: type,
      resend_email_id: data.email_id,
      email_type: emailType,
      recipient: Array.isArray(data.to) ? data.to[0] : data.to,
      subject: data.subject
    };

    switch (type) {
      case RESEND_EVENT_TYPES.EMAIL_SENT:
        eventType = 'email_sent';
        eventMetadata.sent_at = data.created_at;
        break;

      case RESEND_EVENT_TYPES.EMAIL_DELIVERED:
        eventType = 'email_delivered';
        eventMetadata.delivered_at = data.delivered_at;
        break;

      case RESEND_EVENT_TYPES.EMAIL_DELIVERY_FAILED:
        eventType = 'email_delivery_failed';
        break;

      case RESEND_EVENT_TYPES.EMAIL_OPENED:
        eventType = 'email_opened';
        eventMetadata.opened_at = data.opened_at;
        break;

      case RESEND_EVENT_TYPES.EMAIL_CLICKED:
        eventType = 'email_clicked';
        eventMetadata.clicked_at = data.clicked_at;
        eventMetadata.clicked_link = data.click?.link;
        break;

      case RESEND_EVENT_TYPES.EMAIL_BOUNCED:
        eventType = 'email_bounced';
        eventMetadata.bounced_at = data.bounced_at;
        eventMetadata.bounce_type = data.bounce?.type;
        eventMetadata.bounce_message = data.bounce?.message;
        break;

      case RESEND_EVENT_TYPES.EMAIL_COMPLAINED:
        eventType = 'email_complained';
        eventMetadata.complained_at = data.complained_at;
        break;

      default:
        console.log('Unhandled Resend event type:', type);
    }

    // Log the event to booking_events
    await supabase.from('booking_events').insert({
      booking_id: bookingId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      actor_type: 'system',
      actor_id: 'resend-webhook',
      metadata: eventMetadata
    });

    // Log to inbox_emails table
    await logEmailEvent(supabase, webhookData, bookingId);

    // Handle specific email types
    if (type === RESEND_EVENT_TYPES.EMAIL_DELIVERED && emailType === 'booking_confirmation') {
      // Update booking to indicate confirmation email was delivered
      await supabase
        .from('bookings')
        .update({
          confirmation_email_sent_at: data.delivered_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
    }

    // Log successful processing
    logSecurityEvent('info', 'Webhook processed successfully', {
      webhookId: webhookId.substring(0, 16) + '...',
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
    
    // SECURITY: Don't expose internal error details
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to log email events to inbox_emails table
async function logEmailEvent(
  supabase: any,
  webhookData: any,
  bookingId?: string
) {
  try {
    const { type, data } = webhookData;
    
    // Map Resend event type to inbox email status
    const statusMap: Record<string, string> = {
      [RESEND_EVENT_TYPES.EMAIL_SENT]: 'sent',
      [RESEND_EVENT_TYPES.EMAIL_DELIVERED]: 'delivered',
      [RESEND_EVENT_TYPES.EMAIL_DELIVERY_FAILED]: 'failed',
      [RESEND_EVENT_TYPES.EMAIL_OPENED]: 'opened',
      [RESEND_EVENT_TYPES.EMAIL_CLICKED]: 'clicked',
      [RESEND_EVENT_TYPES.EMAIL_BOUNCED]: 'bounced',
      [RESEND_EVENT_TYPES.EMAIL_COMPLAINED]: 'complained'
    };

    const status = statusMap[type] || 'unknown';

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('inbox_emails')
      .select('id')
      .eq('resend_email_id', data.email_id)
      .single();

    if (existingEmail) {
      // Update existing email record
      await supabase
        .from('inbox_emails')
        .update({
          last_event_type: status,
          last_event_at: new Date().toISOString(),
          bounce_type: data.bounce?.type || null,
          bounce_description: data.bounce?.message || null,
          opened_at: data.opened_at ? new Date(data.opened_at).toISOString() : null,
          clicked_at: data.clicked_at ? new Date(data.clicked_at).toISOString() : null,
          raw_payload: webhookData
        })
        .eq('id', existingEmail.id);
    } else {
      // Insert new email record
      await supabase.from('inbox_emails').insert({
        resend_email_id: data.email_id,
        sender_email: data.from,
        recipient_email: Array.isArray(data.to) ? data.to[0] : data.to,
        subject: data.subject,
        last_event_type: status,
        booking_id: bookingId,
        tags: {
          email_type: data.tags?.email_type || 'transactional',
          booking_id: data.tags?.booking_id
        },
        bounce_type: data.bounce?.type,
        bounce_description: data.bounce?.message,
        opened_at: data.opened_at ? new Date(data.opened_at).toISOString() : null,
        clicked_at: data.clicked_at ? new Date(data.clicked_at).toISOString() : null,
        raw_payload: webhookData,
        created_at: data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
        last_event_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error logging email event to inbox_emails:', error);
    // Don't throw - this is a non-critical operation
  }
} 