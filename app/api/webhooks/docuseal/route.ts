import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { createHmac } from 'crypto'

// DocuSeal webhook event types
type DocuSealWebhookEvent = 
  | 'form.viewed'     // Customer opened the contract
  | 'form.started'    // Customer began filling
  | 'form.completed'  // Contract signed
  | 'form.declined'   // Customer declined to sign

interface DocuSealWebhookPayload {
  event_type: DocuSealWebhookEvent
  timestamp: string
  data: {
    id: number
    submission_id: number
    email: string
    status: 'completed' | 'declined' | 'opened' | 'sent' | 'awaiting'
    completed_at?: string
    declined_at?: string
    documents?: Array<{
      name: string
      url: string
    }>
    metadata?: {
      booking_id: string
      customer_id?: string
    }
  }
}

// Map DocuSeal events to our booking events
const eventTypeMapping = {
  'form.viewed': 'contract_viewed',
  'form.started': 'contract_viewed', // We treat started as viewed
  'form.completed': 'contract_signed',
  'form.declined': 'contract_declined'
} as const

// Map DocuSeal status to our contract status
const statusMapping = {
  'sent': 'sent',
  'opened': 'viewed',
  'completed': 'signed',
  'declined': 'declined',
  'awaiting': 'not_sent'
} as const

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify webhook signature
    const signature = request.headers.get('X-DocuSeal-Signature')
    if (!signature) {
      console.error('DocuSeal webhook: Missing signature')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    // Verify HMAC signature
    const webhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('DocuSeal webhook: Missing webhook secret configuration')
      return NextResponse.json(
        { error: 'Webhook configuration error' },
        { status: 500 }
      )
    }

    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    if (`sha256=${expectedSignature}` !== signature) {
      console.error('DocuSeal webhook: Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the payload
    const payload: DocuSealWebhookPayload = JSON.parse(rawBody)
    console.log('DocuSeal webhook received:', {
      event_type: payload.event_type,
      submission_id: payload.data.submission_id,
      status: payload.data.status,
      booking_id: payload.data.metadata?.booking_id
    })

    // Extract booking ID from metadata
    const bookingId = payload.data.metadata?.booking_id
    if (!bookingId) {
      console.error('DocuSeal webhook: Missing booking_id in metadata')
      return NextResponse.json(
        { error: 'Missing booking_id in metadata' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role for webhook operations
    const supabase = createSupabaseServiceRoleClient()

    // Get the current booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, contract_status, contract_submission_id, customer_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('DocuSeal webhook: Booking not found', bookingError)
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Map the event type to our booking event type
    const bookingEventType = eventTypeMapping[payload.event_type]
    const newContractStatus = statusMapping[payload.data.status]

    // Prepare booking update data
    const updateData: any = {
      contract_status: newContractStatus,
      updated_at: new Date().toISOString()
    }

    // Add specific fields based on event type
    if (payload.event_type === 'form.completed' && payload.data.completed_at) {
      updateData.contract_signed_at = payload.data.completed_at
      
      // Store the document URL if available
      const signedDoc = payload.data.documents?.[0]
      if (signedDoc) {
        updateData.contract_document_id = String(payload.data.id)
      }
    }

    // Update booking with new contract status
    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)

    if (updateError) {
      console.error('DocuSeal webhook: Failed to update booking', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 }
      )
    }

    // Create booking event for timeline
    const eventSummary = {
      'contract_viewed': `Contract viewed by ${payload.data.email}`,
      'contract_signed': `Contract signed by ${payload.data.email}`,
      'contract_declined': `Contract declined by ${payload.data.email}`
    }[bookingEventType] || `Contract event: ${payload.event_type}`

    const { error: eventError } = await supabase
      .from('booking_events')
      .insert({
        booking_id: bookingId,
        event_type: bookingEventType,
        actor_type: 'webhook_esignature',
        actor_id: 'docuseal',
        summary_text: eventSummary,
        details: {
          docuseal_event: payload.event_type,
          submission_id: payload.data.submission_id,
          email: payload.data.email,
          status: payload.data.status,
          timestamp: payload.timestamp,
          documents: payload.data.documents
        }
      })

    if (eventError) {
      console.error('DocuSeal webhook: Failed to create booking event', eventError)
      // Don't fail the webhook for this, just log it
    }

    // If contract is signed, we might want to store the PDF
    if (payload.event_type === 'form.completed' && payload.data.documents?.[0]) {
      // TODO: Implement PDF download and storage to booking_media
      // This would involve:
      // 1. Downloading the PDF from DocuSeal
      // 2. Uploading to Supabase Storage
      // 3. Creating a booking_media record
      console.log('Contract signed, PDF available at:', payload.data.documents[0].url)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      booking_id: bookingId,
      event_type: payload.event_type
    })

  } catch (error) {
    console.error('DocuSeal webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 