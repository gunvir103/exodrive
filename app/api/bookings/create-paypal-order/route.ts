import { NextResponse } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal-client';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';

export async function POST(request: Request) {
  try {
    const { carId, startDate, endDate, bookingId, description } = await request.json();

    if (!carId || !startDate || !endDate) {
        return NextResponse.json({ error: 'Car ID, start date, and end date are required' }, { status: 400 });
    }

    if (!bookingId) {
        return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }
    
    // Calculate price server-side using Supabase function
    const supabase = createSupabaseServiceRoleClient();
    const { data: priceCalculation, error: priceError } = await supabase.rpc('calculate_booking_price', {
        p_car_id: carId,
        p_start_date: startDate,
        p_end_date: endDate
    });
    
    if (priceError || !priceCalculation.success) {
        console.error('Price calculation error:', priceError || priceCalculation.error);
        return NextResponse.json({ 
            error: 'Failed to calculate price', 
            details: priceError?.message || priceCalculation.error 
        }, { status: 400 });
    }
    
    const amount = priceCalculation.final_price;
    
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'PayPal-Request-Id': `booking-${bookingId}-${Date.now()}`, // Unique request ID with booking reference
        },
        body: JSON.stringify({
            intent: 'AUTHORIZE', // Changed from CAPTURE to AUTHORIZE
            purchase_units: [
                {
                    reference_id: `BOOKING-${bookingId}`,
                    custom_id: bookingId, // Store booking ID for webhook reference
                    description: description || 'ExoDrive Car Rental Booking',
                    amount: {
                        currency_code: 'USD',
                        value: String(amount),
                    },
                },
            ],
            payment_source: {
                paypal: {
                    experience_context: {
                        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                        brand_name: 'ExoDrive',
                        locale: 'en-US',
                        landing_page: 'LOGIN',
                        user_action: 'PAY_NOW',
                        return_url: `${process.env.NEXT_PUBLIC_URL}/booking/confirmation`,
                        cancel_url: `${process.env.NEXT_PUBLIC_URL}/booking/cancelled`
                    }
                }
            }
        }),
    });

    const order = await response.json();

    if (!response.ok) {
        console.error('PayPal order creation failed:', order);
        return NextResponse.json({ error: 'Failed to create order', details: order }, { status: response.status });
    }

    return NextResponse.json({ orderID: order.id });
  } catch (error) {
    console.error('Failed to create PayPal order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
} 