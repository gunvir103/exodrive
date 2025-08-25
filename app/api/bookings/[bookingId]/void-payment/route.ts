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
    const { reason } = await request.json();
    
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // Get the payment details from the database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, paypal_authorization_id, status')
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

    // Void the authorized payment
    const voidResponse = await fetch(
      `${PAYPAL_API_BASE}/v2/payments/authorizations/${payment.paypal_authorization_id}/void`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `void-${bookingId}-${Date.now()}`,
        },
      }
    );

    // PayPal returns 204 No Content on successful void
    if (voidResponse.status !== 204) {
      const errorData = await voidResponse.json();
      console.error('PayPal void failed:', errorData);
      return NextResponse.json({ 
        error: 'Failed to void payment', 
        details: errorData 
      }, { status: voidResponse.status });
    }

    // Update the payment status in the database
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'voided',
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
        payment_status: 'voided',
        overall_status: 'cancelled',
      })
      .eq('id', bookingId);

    if (bookingUpdateError) {
      console.error('Failed to update booking status:', bookingUpdateError);
    }

    // Free up car availability
    await supabase
      .from('car_availability')
      .update({ 
        status: 'available',
        booking_id: null,
      })
      .eq('booking_id', bookingId);

    // Log the event
    await supabase
      .from('booking_events')
      .insert({
        booking_id: bookingId,
        event_type: 'payment_voided',
        actor_type: 'admin',
        summary_text: `Payment authorization voided${reason ? `: ${reason}` : '.'}`,
        details: {
          paypalAuthorizationId: payment.paypal_authorization_id,
          reason: reason || 'No reason provided',
        },
      });

    return NextResponse.json({ 
      success: true, 
      message: 'Payment authorization successfully voided',
    });

  } catch (error) {
    console.error('Failed to void payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ 
      error: 'Failed to void payment', 
      details: errorMessage 
    }, { status: 500 });
  }
}