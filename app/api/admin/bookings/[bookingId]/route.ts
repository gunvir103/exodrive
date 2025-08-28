import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { checkAdminApiAuth } from '@/lib/auth/admin-api-check';

export async function GET(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    // Check admin authentication
    const { isValid, response, user } = await checkAdminApiAuth(request.cookies);
    if (!isValid || !user) return response!;
    
    const supabase = createSupabaseServerClient(request.cookies);

    const { bookingId } = params;

    // Fetch booking with all related data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers!bookings_customer_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone,
          address,
          city,
          state,
          zip_code,
          country,
          drivers_license,
          created_at
        ),
        car:cars!bookings_car_id_fkey (
          id,
          name,
          slug,
          model,
          make,
          year,
          price_per_day,
          main_image_url,
          description
        ),
        payments (
          id,
          amount,
          status,
          payment_method,
          transaction_id,
          gateway_response,
          created_at,
          updated_at
        ),
        booking_events (
          id,
          event_type,
          timestamp,
          actor_type,
          actor_id,
          metadata,
          created_at
        ),
        booking_secure_tokens (
          id,
          token,
          created_at,
          expires_at
        ),
        booking_media (
          id,
          media_type,
          file_url,
          file_name,
          file_size,
          uploaded_at,
          uploaded_by_type,
          uploaded_by_id,
          metadata
        ),
        disputes (
          id,
          dispute_status,
          reason,
          amount,
          provider_dispute_id,
          created_at,
          updated_at,
          resolved_at
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      if (bookingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      console.error('Error fetching booking:', bookingError);
      return NextResponse.json(
        { error: 'Failed to fetch booking', details: bookingError.message },
        { status: 500 }
      );
    }

    // Format the response
    const formattedBooking = {
      id: booking.id,
      carId: booking.car_id,
      car: booking.car,
      customer: booking.customer ? {
        ...booking.customer,
        fullName: `${booking.customer.first_name} ${booking.customer.last_name}`.trim()
      } : null,
      startDate: booking.start_date,
      endDate: booking.end_date,
      totalPrice: booking.total_price,
      currency: booking.currency,
      securityDepositAmount: booking.security_deposit_amount,
      overallStatus: booking.overall_status,
      paymentStatus: booking.payment_status,
      contractStatus: booking.contract_status,
      pickupLocation: booking.pickup_location,
      dropoffLocation: booking.dropoff_location,
      notes: booking.notes,
      adminNotes: booking.admin_notes,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
      bookingDays: booking.booking_days,
      payments: booking.payments || [],
      timeline: booking.booking_events?.sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ) || [],
      secureTokens: booking.booking_secure_tokens || [],
      media: booking.booking_media || [],
      disputes: booking.disputes || [],
      // Booking URLs
      bookingUrl: booking.booking_secure_tokens?.[0]?.token 
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${booking.booking_secure_tokens[0].token}`
        : null
    };

    return NextResponse.json(formattedBooking);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in get booking endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}



// Update booking details
export async function PATCH(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    // Check admin authentication
    const { isValid, response, user } = await checkAdminApiAuth(request.cookies);
    if (!isValid || !user) return response!;
    
    const supabase = createSupabaseServerClient(request.cookies);

    const { bookingId } = params;
    const body = await request.json();

    // Schema for updating booking
    const updateBookingSchema = z.object({
      notes: z.string().optional(),
      adminNotes: z.string().optional(),
      pickupLocation: z.string().optional(),
      dropoffLocation: z.string().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      totalPrice: z.number().positive().optional(),
      securityDepositAmount: z.number().nonnegative().optional(),
      overallStatus: z.enum([
        'pending_customer_action',
        'pending_payment',
        'pending_contract',
        'contract_pending_signature',
        'upcoming',
        'active',
        'post_rental',
        'completed',
        'cancelled',
        'failed',
        'disputed'
      ]).optional(),
      paymentStatus: z.enum([
        'pending',
        'authorized',
        'paid',
        'partially_paid',
        'failed',
        'refunded',
        'partially_refunded'
      ]).optional(),
      contractStatus: z.enum([
        'not_sent',
        'sent',
        'viewed',
        'signed',
        'expired',
        'declined'
      ]).optional()
    });

    const validationResult = updateBookingSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Get current booking data for comparison
    const { data: currentBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // If dates are being changed, verify availability
    if (updateData.startDate || updateData.endDate) {
      const newStartDate = updateData.startDate || currentBooking.start_date;
      const newEndDate = updateData.endDate || currentBooking.end_date;

      // Check availability for new dates
      const { data: conflicts, error: availError } = await supabase
        .from('car_availability')
        .select('date')
        .eq('car_id', currentBooking.car_id)
        .gte('date', newStartDate)
        .lte('date', newEndDate)
        .in('status', ['booked', 'pending_confirmation'])
        .neq('booking_id', bookingId); // Exclude current booking

      if (availError) {
        console.error('Error checking availability:', availError);
        return NextResponse.json(
          { error: 'Failed to check availability' },
          { status: 500 }
        );
      }

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { 
            error: 'Car not available for selected dates',
            unavailableDates: conflicts.map(c => c.date)
          },
          { status: 409 }
        );
      }

      // Update car_availability if dates changed
      if (newStartDate !== currentBooking.start_date || newEndDate !== currentBooking.end_date) {
        // Free up old dates
        await supabase
          .from('car_availability')
          .update({ status: 'available' })
          .eq('booking_id', bookingId);

        // Mark new dates as booked
        const dates = [];
        const current = new Date(newStartDate);
        const end = new Date(newEndDate);
        
        while (current <= end) {
          dates.push({
            car_id: currentBooking.car_id,
            date: current.toISOString().split('T')[0],
            status: 'booked',
            booking_id: bookingId
          });
          current.setDate(current.getDate() + 1);
        }

        await supabase
          .from('car_availability')
          .upsert(dates, { onConflict: 'car_id,date' });
      }
    }

    // Map field names from camelCase to snake_case
    const dbUpdateData: any = {};
    if (updateData.notes !== undefined) dbUpdateData.notes = updateData.notes;
    if (updateData.adminNotes !== undefined) dbUpdateData.admin_notes = updateData.adminNotes;
    if (updateData.pickupLocation !== undefined) dbUpdateData.pickup_location = updateData.pickupLocation;
    if (updateData.dropoffLocation !== undefined) dbUpdateData.dropoff_location = updateData.dropoffLocation;
    if (updateData.startDate !== undefined) dbUpdateData.start_date = updateData.startDate;
    if (updateData.endDate !== undefined) dbUpdateData.end_date = updateData.endDate;
    if (updateData.totalPrice !== undefined) dbUpdateData.total_price = updateData.totalPrice;
    if (updateData.securityDepositAmount !== undefined) dbUpdateData.security_deposit_amount = updateData.securityDepositAmount;
    if (updateData.overallStatus !== undefined) dbUpdateData.overall_status = updateData.overallStatus;
    if (updateData.paymentStatus !== undefined) dbUpdateData.payment_status = updateData.paymentStatus;
    if (updateData.contractStatus !== undefined) dbUpdateData.contract_status = updateData.contractStatus;

    // Update the booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        ...dbUpdateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking', details: updateError.message },
        { status: 500 }
      );
    }

    // Log the update event
    const changedFields: any = {};
    for (const key in dbUpdateData) {
      if (currentBooking[key] !== dbUpdateData[key]) {
        changedFields[key] = {
          old: currentBooking[key],
          new: dbUpdateData[key]
        };
      }
    }

    await supabase.from('booking_events').insert({
      booking_id: bookingId,
      event_type: 'admin_updated_booking',
      timestamp: new Date().toISOString(),
      actor_type: 'admin',
      actor_id: user.id,
      metadata: {
        updated_fields: Object.keys(changedFields),
        changes: changedFields,
        admin_email: user.email
      }
    });

    // Handle status-specific actions
    if (updateData.overallStatus && updateData.overallStatus !== currentBooking.overall_status) {
      // Log status change event
      await supabase.from('booking_events').insert({
        booking_id: bookingId,
        event_type: 'booking_status_changed',
        timestamp: new Date().toISOString(),
        actor_type: 'admin',
        actor_id: user.id,
        metadata: {
          from_status: currentBooking.overall_status,
          to_status: updateData.overallStatus,
          admin_email: user.email
        }
      });
    }

    return NextResponse.json({
      message: 'Booking updated successfully',
      booking: updatedBooking
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

// Delete/Cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    // Check admin authentication
    const { isValid, response, user } = await checkAdminApiAuth(request.cookies);
    if (!isValid || !user) return response!;
    
    const supabase = createSupabaseServerClient(request.cookies);

    const { bookingId } = params;
    
    // Parse cancellation reason from body
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'Cancelled by admin';

    // Get current booking status
    const { data: currentBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('overall_status, car_id, start_date, end_date, payment_status')
      .eq('id', bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check if booking can be cancelled
    if (['completed', 'cancelled'].includes(currentBooking.overall_status)) {
      return NextResponse.json(
        { error: `Cannot cancel booking with status: ${currentBooking.overall_status}` },
        { status: 400 }
      );
    }

    // Update booking status to cancelled
    const { data: cancelledBooking, error: cancelError } = await supabase
      .from('bookings')
      .update({
        overall_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (cancelError) {
      console.error('Error cancelling booking:', cancelError);
      return NextResponse.json(
        { error: 'Failed to cancel booking', details: cancelError.message },
        { status: 500 }
      );
    }

    // Free up car availability
    await supabase
      .from('car_availability')
      .update({ status: 'available' })
      .eq('booking_id', bookingId);

    // Log cancellation event
    await supabase.from('booking_events').insert({
      booking_id: bookingId,
      event_type: 'booking_cancelled',
      timestamp: new Date().toISOString(),
      actor_type: 'admin',
      actor_id: user.id,
      metadata: {
        reason,
        admin_email: user.email,
        previous_status: currentBooking.overall_status
      }
    });

    // Handle payment refunds if necessary
    if (currentBooking.payment_status === 'captured' || currentBooking.payment_status === 'paid') {
      try {
        // Get payment records for this booking
        const { data: payments } = await supabase
          .from('payments')
          .select('*')
          .eq('booking_id', bookingId)
          .in('status', ['captured', 'paid'])
          .order('created_at', { ascending: false });

        // Process refunds for captured/paid payments
        if (payments && payments.length > 0) {
          const { getPayPalClient } = await import('@/lib/paypal-client');
          const paypalClient = getPayPalClient();

          for (const payment of payments) {
            if (payment.transaction_id && payment.gateway_response?.capture_id) {
              try {
                // Create refund via PayPal API
                const refundRequest = {
                  amount: {
                    currency_code: payment.currency || 'USD',
                    value: payment.amount.toString()
                  },
                  note_to_payer: `Refund for cancelled booking ${bookingId}`,
                  invoice_id: bookingId
                };

                // Process refund through PayPal
                const refundResponse = await fetch(`https://api-m.${process.env.PAYPAL_MODE === 'sandbox' ? 'sandbox.' : ''}paypal.com/v2/payments/captures/${payment.gateway_response.capture_id}/refund`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await (await import('@/lib/paypal-client')).getPayPalAccessToken()}`,
                    'PayPal-Request-Id': `${bookingId}-${Date.now()}`
                  },
                  body: JSON.stringify(refundRequest)
                });

                if (refundResponse.ok) {
                  const refundData = await refundResponse.json();
                  
                  // Update payment status
                  await supabase
                    .from('payments')
                    .update({
                      status: 'refunded',
                      gateway_response: {
                        ...payment.gateway_response,
                        refund: refundData
                      },
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', payment.id);

                  // Log refund event
                  await supabase.from('booking_events').insert({
                    booking_id: bookingId,
                    event_type: 'payment_refunded',
                    timestamp: new Date().toISOString(),
                    actor_type: 'admin',
                    actor_id: user.id,
                    metadata: {
                      payment_id: payment.id,
                      refund_id: refundData.id,
                      refund_amount: payment.amount,
                      admin_email: user.email
                    }
                  });

                  console.log(`Refund processed for payment ${payment.id}:`, refundData.id);
                } else {
                  const errorData = await refundResponse.text();
                  console.error(`Failed to refund payment ${payment.id}:`, errorData);
                  
                  // Log failed refund event
                  await supabase.from('booking_events').insert({
                    booking_id: bookingId,
                    event_type: 'refund_failed',
                    timestamp: new Date().toISOString(),
                    actor_type: 'system',
                    metadata: {
                      payment_id: payment.id,
                      error: errorData,
                      reason: 'PayPal refund API error'
                    }
                  });
                }
              } catch (refundError) {
                console.error(`Error processing refund for payment ${payment.id}:`, refundError);
                
                // Log refund error event
                await supabase.from('booking_events').insert({
                  booking_id: bookingId,
                  event_type: 'refund_failed', 
                  timestamp: new Date().toISOString(),
                  actor_type: 'system',
                  metadata: {
                    payment_id: payment.id,
                    error: refundError instanceof Error ? refundError.message : 'Unknown error',
                    reason: 'Refund processing exception'
                  }
                });
              }
            }
          }

          // Update booking payment status to reflect refunds
          await supabase
            .from('bookings')
            .update({
              payment_status: 'refunded',
              updated_at: new Date().toISOString()
            })
            .eq('id', bookingId);
        }
      } catch (error) {
        console.error('Error handling refunds during cancellation:', error);
        // Continue with cancellation even if refund fails
        // The refund can be processed manually if needed
      }
    }

    return NextResponse.json({
      message: 'Booking cancelled successfully',
      booking: cancelledBooking
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
} 