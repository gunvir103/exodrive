import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')!
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')!
  const paypalApiBase = Deno.env.get('PAYPAL_MODE') === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com'

  const auth = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json()
  return data.access_token
}

async function capturePayPalPayment(
  authorizationId: string,
  amount: string,
  currency: string
): Promise<PayPalCaptureResponse> {
  const accessToken = await getPayPalAccessToken()
  const paypalApiBase = Deno.env.get('PAYPAL_MODE') === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com'

  const response = await fetch(
    `${paypalApiBase}/v2/payments/authorizations/${authorizationId}/capture`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `capture-${authorizationId}-${Date.now()}`,
      },
      body: JSON.stringify({
        amount: {
          currency_code: currency,
          value: amount,
        },
        final_capture: true,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`PayPal capture failed: ${JSON.stringify(error)}`)
  }

  return await response.json()
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get bookings ready for capture
    const { data: captureData, error: captureError } = await supabase
      .rpc('process_scheduled_payment_captures')

    if (captureError) {
      throw captureError
    }

    const results = []
    const bookingsToCapture = captureData.bookings_to_capture || []

    // Process each booking
    for (const booking of bookingsToCapture) {
      try {
        // Capture payment via PayPal API
        const captureResponse = await capturePayPalPayment(
          booking.authorization_id,
          booking.amount,
          booking.currency
        )

        // Update database with capture result
        const { error: updateError } = await supabase
          .rpc('mark_payment_captured', {
            p_booking_id: booking.booking_id,
            p_capture_id: captureResponse.id,
            p_captured_amount: parseFloat(captureResponse.amount.value),
          })

        if (updateError) {
          console.error(`Failed to update booking ${booking.booking_id}:`, updateError)
          results.push({
            booking_id: booking.booking_id,
            success: false,
            error: updateError.message,
          })
        } else {
          results.push({
            booking_id: booking.booking_id,
            success: true,
            capture_id: captureResponse.id,
          })
        }
      } catch (error) {
        console.error(`Failed to capture payment for booking ${booking.booking_id}:`, error)
        
        // Log failed capture attempt
        await supabase
          .from('booking_events')
          .insert({
            booking_id: booking.booking_id,
            event_type: 'payment_capture_failed',
            event_data: {
              error: error.message,
              authorization_id: booking.authorization_id,
            },
          })

        results.push({
          booking_id: booking.booking_id,
          success: false,
          error: error.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: bookingsToCapture.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})