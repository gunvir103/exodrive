import { NextResponse } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal-client';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';

export async function POST(request: Request) {
  const supabase = createSupabaseServiceRoleClient();
  try {
    const { orderID, bookingDetails } = await request.json();

    if (!orderID) {
        return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }
    if (!bookingDetails) {
        return NextResponse.json({ error: 'Booking details are required' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    // Authorize the payment (not capture immediately)
    const authorizeResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/authorize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'PayPal-Request-Id': `authorize-${Date.now()}`,
        },
    });

    const authorizedData = await authorizeResponse.json();

    if (!authorizeResponse.ok || authorizedData.status !== 'COMPLETED') {
        console.error('PayPal payment authorization failed:', authorizedData);
        return NextResponse.json({ error: 'Failed to authorize payment', details: authorizedData }, { status: authorizeResponse.status });
    }
    
    // --- Database Operations ---
    // At this point, the payment is successful. Now, create the booking in the database.
    // This should ideally be a single transaction. We can use a Supabase edge function (RPC) for this.
    
    const { carId, startDate, endDate, totalPrice: clientPrice, customer } = bookingDetails;
    
    // Validate price server-side
    const { data: priceValidation, error: validationError } = await supabase.rpc('validate_booking_price', {
        p_car_id: carId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_client_price: clientPrice
    });
    
    if (validationError || !priceValidation.valid) {
        console.error('Price validation failed:', validationError || priceValidation.error);
        return NextResponse.json({ 
            error: 'Price validation failed', 
            details: validationError?.message || priceValidation.error 
        }, { status: 400 });
    }
    
    // Use server-calculated price
    const totalPrice = priceValidation.server_calculation.final_price;

    // Extract authorization ID from the authorized data with safe property access
    const authorizationId = authorizedData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
    const authorizedAmount = authorizedData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.amount?.value;

    if (!authorizationId || !authorizedAmount) {
        console.error('Missing authorization data in PayPal response:', {
            hasAuthorizationId: !!authorizationId,
            hasAuthorizedAmount: !!authorizedAmount,
            responseStructure: JSON.stringify(authorizedData, null, 2)
        });
        return NextResponse.json({ 
            error: 'Invalid PayPal authorization response - missing required fields',
            details: 'Authorization ID or amount not found in response'
        }, { status: 500 });
    }

    const { data: bookingResult, error } = await supabase.rpc('create_booking_with_paypal_authorization', {
        p_car_id: carId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_total_price: totalPrice,
        p_customer_first_name: customer.firstName,
        p_customer_last_name: customer.lastName,
        p_customer_email: customer.email,
        p_customer_phone: customer.phone,
        p_paypal_order_id: authorizedData.id,
        p_paypal_authorization_id: authorizationId,
        p_amount_authorized: authorizedAmount,
    });

    if (error || (bookingResult && !bookingResult.success)) {
        console.error('Supabase booking creation error:', error || bookingResult.error);
        // If the booking fails, we should ideally refund the payment.
        // This is a complex flow that requires further implementation.
        // For now, we'll log the error and return a failure response.
        const errorDetails = error ? error.message : (bookingResult.details || 'Unknown database error');
        return NextResponse.json({ error: 'Booking creation failed after successful payment.', details: errorDetails }, { status: 500 });
    }

    // CRITICAL: Generate DocuSeal contract after successful booking and payment authorization
    // This must be non-blocking to prevent PayPal flow timeout
    Promise.resolve().then(async () => {
      try {
        const { getDocuSealService } = await import('@/lib/services/docuseal-service');
        const docusealService = getDocuSealService();
        
        console.log(`Generating contract for booking ${bookingResult.bookingId}`)
        
        const contractResult = await docusealService.generateContract(bookingResult.bookingId);
        
        if (contractResult.success) {
          console.log(`Contract successfully generated for booking ${bookingResult.bookingId}:`, contractResult.submissionId);
          
          // Update booking with contract submission ID
          await supabase
            .from('bookings')
            .update({
              contract_submission_id: contractResult.submissionId,
              contract_status: 'sent',
              updated_at: new Date().toISOString()
            } as any) // Cast to any for contract fields that may not be in types
            .eq('id', bookingResult.bookingId);
            
          // Log successful contract generation
          await supabase.from('booking_events').insert({
            booking_id: bookingResult.bookingId,
            event_type: 'contract_auto_generated',
            actor_type: 'system',
            actor_id: 'paypal-authorization',
            summary_text: 'Contract automatically generated and sent after payment authorization',
            details: {
              submission_id: contractResult.submissionId,
              authorization_id: authorizationId,
              paypal_order_id: authorizedData.id
            }
          });
        } else {
          console.error(`Contract generation failed for booking ${bookingResult.bookingId}:`, contractResult.error);
          
          // Log contract generation failure for admin attention  
          await supabase.from('booking_events').insert({
            booking_id: bookingResult.bookingId,
            event_type: 'contract_generation_failed',
            actor_type: 'system',
            actor_id: 'paypal-authorization',
            summary_text: 'Contract generation failed after successful payment authorization',
            details: {
              error: contractResult.error,
              authorization_id: authorizationId,
              paypal_order_id: authorizedData.id,
              requires_manual_contract_generation: true
            }
          });
        }
      } catch (error: any) {
        console.error(`Contract generation error for booking ${bookingResult.bookingId}:`, error);
        
        // Log system error for admin attention
        await supabase.from('booking_events').insert({
          booking_id: bookingResult.bookingId,
          event_type: 'contract_generation_error',
          actor_type: 'system',
          actor_id: 'paypal-authorization',
          summary_text: 'System error during contract generation',
          details: {
            error: error.message,
            authorization_id: authorizationId,
            paypal_order_id: authorizedData.id,
            requires_manual_intervention: true
          }
        });
      }
    }).catch(console.error); // Ensure promise rejection doesn't crash main flow

    return NextResponse.json({ success: true, bookingId: bookingResult.bookingId, authorizedData, authorizationId });
  } catch (error) {
    console.error('Failed to authorize PayPal order:', error);
    // Type guard for error
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to authorize order', details: errorMessage }, { status: 500 });
  }
} 