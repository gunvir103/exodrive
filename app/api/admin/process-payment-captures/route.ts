import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getPayPalAccessToken } from '@/lib/paypal-client';

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';

// This endpoint should be called by a cron job (e.g., Vercel Cron or similar)
// It processes scheduled payment captures
export async function POST(request: Request) {
    // Verify the request is from a trusted source (e.g., cron secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServiceRoleClient();
    const results = [];

    try {
        // Get bookings ready for capture
        const { data: captureData, error: captureError } = await supabase
            .rpc('process_scheduled_payment_captures');

        if (captureError) {
            console.error('Failed to get bookings for capture:', captureError);
            return NextResponse.json({ 
                error: 'Failed to process payment captures', 
                details: captureError.message 
            }, { status: 500 });
        }

        const bookingsToCapture = captureData?.bookings_to_capture || [];
        
        // Process each booking
        for (const booking of bookingsToCapture) {
            try {
                // Get PayPal access token
                const accessToken = await getPayPalAccessToken();

                // Capture the payment
                const captureResponse = await fetch(
                    `${PAYPAL_API_BASE}/v2/payments/authorizations/${booking.authorization_id}/capture`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'PayPal-Request-Id': `capture-${booking.authorization_id}-${Date.now()}`,
                        },
                        body: JSON.stringify({
                            amount: {
                                currency_code: booking.currency,
                                value: booking.amount,
                            },
                            final_capture: true,
                        }),
                    }
                );

                const captureResult = await captureResponse.json();

                if (!captureResponse.ok) {
                    throw new Error(`PayPal capture failed: ${JSON.stringify(captureResult)}`);
                }

                // Update database with capture result
                const { error: updateError } = await supabase
                    .rpc('mark_payment_captured', {
                        p_booking_id: booking.booking_id,
                        p_capture_id: captureResult.id,
                        p_captured_amount: parseFloat(captureResult.amount.value),
                    });

                if (updateError) {
                    console.error(`Failed to update booking ${booking.booking_id}:`, updateError);
                    results.push({
                        booking_id: booking.booking_id,
                        success: false,
                        error: updateError.message,
                    });
                } else {
                    results.push({
                        booking_id: booking.booking_id,
                        success: true,
                        capture_id: captureResult.id,
                    });
                }
            } catch (error) {
                console.error(`Failed to capture payment for booking ${booking.booking_id}:`, error);
                
                // Log failed capture attempt
                await supabase
                    .from('booking_events')
                    .insert({
                        booking_id: booking.booking_id,
                        event_type: 'payment_capture_failed',
                        event_data: {
                            error: error instanceof Error ? error.message : 'Unknown error',
                            authorization_id: booking.authorization_id,
                        },
                    });

                results.push({
                    booking_id: booking.booking_id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed_count: bookingsToCapture.length,
            results,
        });
    } catch (error) {
        console.error('Failed to process payment captures:', error);
        return NextResponse.json({ 
            error: 'Failed to process payment captures', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}

// GET endpoint for manual testing/monitoring
export async function GET() {
    return NextResponse.json({
        message: 'Payment capture processor is running',
        info: 'Use POST method with proper authorization to process captures',
    });
}