import { NextResponse } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal-client';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';

export async function POST(
  request: Request,
  { params }: { params: { bookingId: string } }
) {
  const supabase = createSupabaseServiceRoleClient();
  
  try {
    const { bookingId } = params;
    
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // Get the payment details from the database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, paypal_authorization_id, amount, status')
      .eq('booking_id', bookingId)
      .single();

    if (paymentError || !payment) {
      console.error('Failed to retrieve payment:', paymentError);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'authorized') {
      return NextResponse.json({ 
        error: 'Payment is not in authorized state', 
        currentStatus: payment.status 
      }, { status: 400 });
    }

    if (!payment.paypal_authorization_id) {
      return NextResponse.json({ error: 'No authorization ID found' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the authorized payment
    const captureResponse = await fetch(
      `${PAYPAL_API_BASE}/v2/payments/authorizations/${payment.paypal_authorization_id}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `capture-${bookingId}-${Date.now()}`,
        },
        body: JSON.stringify({
          amount: {
            currency_code: 'USD',
            value: String(payment.amount),
          },
          final_capture: true,
        }),
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
      console.error('PayPal capture failed:', captureData);
      return NextResponse.json({ 
        error: 'Failed to capture payment', 
        details: captureData 
      }, { status: captureResponse.status });
    }

    // Update the payment status in the database
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'captured',
        captured_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Failed to update payment status:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update payment status', 
        details: updateError 
      }, { status: 500 });
    }

    // Update booking status
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({ 
        payment_status: 'captured',
        overall_status: 'upcoming',
      })
      .eq('id', bookingId);

    if (bookingUpdateError) {
      console.error('Failed to update booking status:', bookingUpdateError);
    }

    // Update car availability to fully booked
    const { data: booking } = await supabase
      .from('bookings')
      .select('car_id, start_date, end_date')
      .eq('id', bookingId)
      .single();

    if (booking) {
      await supabase
        .from('car_availability')
        .update({ status: 'booked' })
        .eq('booking_id', bookingId);
    }

    // Log the event
    await supabase
      .from('booking_events')
      .insert({
        booking_id: bookingId,
        event_type: 'payment_captured',
        actor_type: 'admin',
        summary_text: 'Payment successfully captured.',
        details: {
          paypalCaptureId: captureData.id,
          amount: payment.amount,
        },
      });

    return NextResponse.json({ 
      success: true, 
      captureId: captureData.id,
      status: captureData.status,
    });

  } catch (error) {
    console.error('Failed to capture payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ 
      error: 'Failed to capture payment', 
      details: errorMessage 
    }, { status: 500 });
  }
}