import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'
import crypto from 'crypto'
import { DOCUSEAL_CONSTANTS } from '@/lib/constants/docuseal'
import {
  ContractUpdateData,
  BookingEventInsert,
  BookingEventDetails,
  BookingMediaInsert,
  isValidUUID,
  extractBookingId,
  CONTRACT_STATUS_MAP
} from '@/lib/types/docuseal'

// Use centralized constants for event types
const DOCUSEAL_EVENT_TYPES = DOCUSEAL_CONSTANTS.EVENT_TYPES

// DocuSeal webhook payload schema
const docusealWebhookSchema = z.object({
  event_type: z.string(),
  timestamp: z.number(),
  data: z.object({
    id: z.number(),
    submission_id: z.number().optional(),
    slug: z.string().optional(),
    source: z.string().optional(),
    submitters: z.array(z.object({
      id: z.number(),
      email: z.string().email(),
      slug: z.string(),
      sent_at: z.string().nullable(),
      viewed_at: z.string().nullable(),
      completed_at: z.string().nullable(),
      declined_at: z.string().nullable().optional(),
      name: z.string().optional(),
      phone: z.string().optional(),
      status: z.enum(['pending', 'sent', 'opened', 'completed', 'declined']).optional(),
      metadata: z.record(z.any()).optional()
    })).optional(),
    template: z.object({
      id: z.number(),
      name: z.string(),
      slug: z.string().optional(),
      folder_name: z.string().optional()
    }).optional(),
    created_at: z.string(),
    updated_at: z.string(),
    archived_at: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional(),
    expire_at: z.string().nullable().optional(),
    documents: z.array(z.object({
      id: z.number(),
      name: z.string(),
      url: z.string()
    })).optional(),
    metadata: z.record(z.any()).optional()
  })
})

// Verify DocuSeal webhook signature
function verifyDocusealWebhook(
  request: NextRequest,
  body: string
): boolean {
  const signature = request.headers.get('x-docuseal-signature')
  if (!signature) {
    console.error('Missing DocuSeal signature header')
    return false
  }

  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET
  if (!secret) {
    console.warn('DOCUSEAL_WEBHOOK_SECRET not set, skipping verification')
    return true // In development, allow unverified webhooks
  }

  // DocuSeal uses HMAC-SHA256 for webhook signatures
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  return signature === expectedSignature
}

export async function POST(request: NextRequest) {
  // Safely pass cookies object to Supabase client
  const supabase = createSupabaseServerClient(request.cookies)
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify webhook signature
    const isValid = verifyDocusealWebhook(request, rawBody)
    if (!isValid) {
      console.error('Invalid DocuSeal webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse JSON body
    const body = JSON.parse(rawBody)

    // Validate webhook payload
    const validationResult = docusealWebhookSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Invalid DocuSeal webhook payload:', validationResult.error)
      return NextResponse.json(
        { error: 'Invalid payload', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const webhookData = validationResult.data
    const { event_type, data } = webhookData

    // Extract and validate booking ID from metadata
    const bookingId = extractBookingId(data);
    
    if (!bookingId) {
      console.warn('No valid booking ID found in DocuSeal webhook:', webhookData)
      return NextResponse.json({ message: 'No booking ID found' }, { status: 200 })
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('Booking not found for DocuSeal webhook:', bookingId)
      return NextResponse.json({ message: 'Booking not found' }, { status: 200 })
    }

    // Handle different event types with proper typing
    let updateData: Partial<ContractUpdateData> = {}
    let eventType = 'contract_webhook_received'
    let eventMetadata: BookingEventDetails = {
      docuseal_event_type: event_type,
      docuseal_submission_id: data.submission_id || data.id,
      template_name: data.template?.name
    }

    switch (event_type) {
      case DOCUSEAL_EVENT_TYPES.SUBMISSION_CREATED:
        updateData.contract_status = 'sent'
        eventType = 'contract_sent'
        eventMetadata.sent_at = data.created_at
        
        // Store DocuSeal submission ID if not already stored
        if (!booking.docuseal_submission_id) {
          updateData.docuseal_submission_id = data.id.toString()
        }
        break

      case DOCUSEAL_EVENT_TYPES.SUBMISSION_VIEWED:
        if (booking.contract_status === 'sent') {
          updateData.contract_status = 'viewed'
        }
        eventType = 'contract_viewed'
        eventMetadata.viewed_at = data.submitters?.[0]?.viewed_at
        break

      case DOCUSEAL_EVENT_TYPES.SUBMISSION_COMPLETED:
        updateData.contract_status = 'signed'
        eventType = 'contract_signed'
        eventMetadata.signed_at = data.completed_at
        eventMetadata.documents = data.documents
        
        // Store signed document URL
        if (data.documents && data.documents.length > 0) {
          updateData.contract_document_url = data.documents[0].url
        }
        
        // Store signed contract as booking media
        if (data.documents) {
          for (const doc of data.documents) {
            await supabase.from('booking_media').insert({
              booking_id: bookingId,
              stage: 'completed', // Required field
              type: 'contract', // Required field  
              file_url: doc.url,
              file_path: doc.url, // Use URL as path for external documents
              file_name: doc.name,
              storage_bucket_id: 'external-docuseal', // External storage indicator
              uploaded_at: new Date().toISOString(),
              uploaded_by_type: 'system',
              uploaded_by_id: 'docuseal-webhook',
              metadata: {
                docuseal_document_id: doc.id,
                docuseal_submission_id: data.id
              }
            })
          }
        }

        // CRITICAL: Trigger payment capture when contract is signed
        // This must be non-blocking to prevent webhook timeout
        if (booking.payment_status === 'authorized') {
          Promise.resolve().then(async () => {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
              
              console.log(`Triggering payment capture for booking ${bookingId} after contract signing`)
              
              const captureResponse = await fetch(`${baseUrl}/api/bookings/${bookingId}/capture-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` // Internal API call
                }
              })

              if (!captureResponse.ok) {
                const errorData = await captureResponse.text()
                console.error(`Failed to capture payment for booking ${bookingId}:`, errorData)
                
                // Log critical failure for admin attention
                await supabase.from('booking_events').insert({
                  booking_id: bookingId,
                  event_type: 'payment_capture_failed',
                  actor_type: 'system',
                  actor_id: 'docuseal-webhook',
                  summary_text: 'CRITICAL: Payment capture failed after contract signing',
                  details: {
                    error: errorData,
                    contract_signed_at: data.completed_at,
                    submission_id: data.id,
                    requires_manual_intervention: true
                  }
                })
              } else {
                const captureData = await captureResponse.json()
                console.log(`Payment successfully captured for booking ${bookingId}:`, captureData.captureId)
                
                // Log successful automatic capture
                await supabase.from('booking_events').insert({
                  booking_id: bookingId,
                  event_type: 'payment_auto_captured',
                  actor_type: 'system',
                  actor_id: 'docuseal-webhook',
                  summary_text: 'Payment automatically captured after contract signing',
                  details: {
                    capture_id: captureData.captureId,
                    contract_signed_at: data.completed_at,
                    submission_id: data.id
                  }
                })
              }
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Payment capture error for booking ${bookingId}:`, error)
              
              // Log system error for admin attention
              await supabase.from('booking_events').insert({
                booking_id: bookingId,
                event_type: 'payment_capture_error',
                actor_type: 'system',
                actor_id: 'docuseal-webhook',
                summary_text: 'CRITICAL: System error during payment capture',
                details: {
                  error: errorMessage,
                  contract_signed_at: data.completed_at,
                  submission_id: data.id,
                  requires_manual_intervention: true
                }
              })
            }
          }).catch(console.error) // Ensure promise rejection doesn't crash webhook
        }
        break

      case DOCUSEAL_EVENT_TYPES.SUBMISSION_EXPIRED:
        updateData.contract_status = 'expired'
        eventType = 'contract_expired'
        eventMetadata.expired_at = data.expire_at
        break

      case DOCUSEAL_EVENT_TYPES.SUBMISSION_ARCHIVED:
        eventType = 'contract_archived'
        eventMetadata.archived_at = data.archived_at
        break

            default:
        console.log('Unhandled DocuSeal event type:', event_type);
    }

    // Check if submitter declined
    const submitter = data.submitters?.[0]
    if (submitter?.declined_at && submitter.status === 'declined') {
      updateData.contract_status = 'declined'
      eventType = 'contract_declined'
      eventMetadata.declined_at = submitter.declined_at
      eventMetadata.declined_by = submitter.email
    }

    // Update booking if needed
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (updateError) {
        console.error('Error updating booking from DocuSeal webhook:', updateError)
      }
    }

    // Log the event
    const bookingEvent: BookingEventInsert = {
      booking_id: bookingId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      actor_type: 'system',
      actor_id: 'docuseal-webhook',
      details: eventMetadata
    };
    await supabase.from('booking_events').insert(bookingEvent)

    return NextResponse.json({ 
      message: 'Webhook processed successfully',
      bookingId,
      eventType 
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing DocuSeal webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
} 