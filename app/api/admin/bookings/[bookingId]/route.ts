import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { cookies } from 'next/headers';

// Schema for validating the bookingId parameter
const paramsSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID format"),
});

// Schema for validating the updatable booking fields
// Making most fields optional as admin might update only a few at a time.
const updateBookingBodySchema = z.object({
  pickup_location: z.string().optional(),
  dropoff_location: z.string().optional(),
  pickup_time: z.string().optional(), // Consider validating as time string if specific format needed
  dropoff_time: z.string().optional(), // Consider validating as time string
  admin_notes: z.string().nullable().optional(),
  overall_status: z.enum([
    'pending_customer_action',
    'pending_payment',
    'pending_confirmation',
    'confirmed',
    'active_rental',
    'completed',
    'cancelled_by_customer',
    'cancelled_by_admin',
    'no_show',
    'disputed'
  ]).optional(),
  payment_status: z.enum([
    'pending_authorization',
    'authorized',
    'captured',
    'failed',
    'refunded',
    'partially_refunded',
    'chargeback'
  ]).optional(),
  contract_status: z.enum([
    'pending_signature',
    'signed',
    'active',
    'breached',
    'terminated'
  ]).optional(),
  contract_document_url: z.string().url().nullable().optional(),
  // Fields like total_price, car_id, customer_id, start_date, end_date are generally not updated this way.
  // They might require a more complex process (e.g., re-booking, cancellation + new booking).
}).strict(); // Use .strict() to prevent unknown fields

export async function GET(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // TODO: Implement admin role check (similar to the list bookings endpoint)
  // Ensure only authenticated admins can access this route.

  // Validate params
  const validationResult = paramsSchema.safeParse(params);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid booking ID", details: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const { bookingId } = validationResult.data;

  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        created_at,
        updated_at,
        start_date,
        end_date,
        total_price,
        currency,
        discount_percentage,
        discount_amount,
        final_price,
        security_deposit_amount,
        pickup_location,
        dropoff_location,
        pickup_time,
        dropoff_time,
        customer_notes,
        admin_notes,
        overall_status,
        payment_status,
        contract_status,
        contract_document_url,
        customer_id,
        car_id,
        cars (*, car_images(*)),
        customers (*),
        booking_payments (*),
        booking_secure_tokens (token, expires_at, used_at),
        booking_audit_logs (*)
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // PostgREST error code for "Not found"
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      console.error('Error fetching booking details:', error);
      return NextResponse.json(
        { error: 'Failed to fetch booking details', details: error.message },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    
    // Potentially fetch related car_availability for the booking period if needed
    // This might be useful for an admin view to see the calendar context
    // const { data: availability, error: availabilityError } = await supabase
    //   .from('car_availability')
    //   .select('date, status')
    //   .eq('car_id', booking.car_id)
    //   .gte('date', booking.start_date)
    //   .lte('date', booking.end_date)
    //   .order('date', { ascending: true });

    // if (availabilityError) {
    //   console.warn('Could not fetch car availability for booking:', availabilityError);
    // }

    return NextResponse.json({ 
      ...booking,
      // car_availability_period: availability || [] 
    });

  } catch (e: any) {
    console.error('Unexpected error in GET /api/admin/bookings/[bookingId]:', e);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // TODO: Implement admin role check. For now, we assume the route is protected by middleware or other means.
  // const { data: { user }, error: authError } = await supabase.auth.getUser();
  // if (authError || !user) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  // // Implement actual role check based on your user_roles table or claims
  // const isAdmin = true; // Replace with actual role check
  // if (!isAdmin) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  // Validate bookingId from URL params
  const paramsValidation = paramsSchema.safeParse(params);
  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: "Invalid booking ID", details: paramsValidation.error.flatten() },
      { status: 400 }
    );
  }
  const { bookingId } = paramsValidation.data;

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const bodyValidation = updateBookingBodySchema.safeParse(requestBody);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: bodyValidation.error.flatten() },
      { status: 400 }
    );
  }

  const updates = bodyValidation.data;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No update fields provided' }, 
      { status: 400 }
    );
  }

  try {
    // 1. Fetch existing booking to ensure it exists and potentially get old values for audit
    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*') // Select all for audit comparison if needed, or specific fields
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 2. Update the booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select('*') // Return the updated record
      .single();

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking', details: updateError.message },
        { status: 500 }
      );
    }

    // 3. Create an audit log entry (simplified)
    // TODO: Get actual admin user ID once auth is in place
    const adminUserId = 'ADMIN_USER_PLACEHOLDER'; // Replace with actual user ID from session/auth
    const changesMade: Record<string, any> = {};
    for (const key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        const typedKey = key as keyof typeof updates;
        if (existingBooking[typedKey] !== updates[typedKey]) {
          changesMade[typedKey] = {
            old: existingBooking[typedKey],
            new: updates[typedKey],
          };
        }
      }
    }

    if (Object.keys(changesMade).length > 0) {
      const { error: auditError } = await supabase
        .from('booking_audit_logs')
        .insert({
          booking_id: bookingId,
          user_id: adminUserId, // This should be the admin's user_id
          action: 'admin_update',
          changed_fields: changesMade,
          // details: 'Booking updated by admin' // Optional: more human-readable details
        });

      if (auditError) {
        console.error('Failed to create audit log for booking update:', auditError);
        // Non-critical error, so we don't fail the whole request, but log it.
      }
    }

    // If status changed to 'confirmed', update car_availability
    if (updates.overall_status === 'confirmed' && existingBooking.overall_status !== 'confirmed') {
      const { error: availError } = await supabase
        .from('car_availability')
        .update({ status: 'booked' })
        .eq('car_id', existingBooking.car_id)
        .gte('date', existingBooking.start_date)
        .lte('date', existingBooking.end_date)
        .in('status', ['available', 'pending_confirmation']); // Only update if not already booked or in maintenance
      if (availError) console.error('Error updating car_availability to booked:', availError); // Log but don't fail request
    }

    return NextResponse.json(updatedBooking);

  } catch (e: any) {
    console.error('Unexpected error in PUT /api/admin/bookings/[bookingId]:', e);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: e.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/bookings/[bookingId]/cancel
export async function POST(
  request: NextRequest, // Keep request parameter even if not used, for consistent signature
  { params }: { params: { bookingId: string } }
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const adminUserId = 'ADMIN_USER_PLACEHOLDER'; // Replace with actual user ID

  const paramsValidation = paramsSchema.safeParse(params);
  if (!paramsValidation.success) {
    return NextResponse.json({ error: "Invalid booking ID", details: paramsValidation.error.flatten()}, { status: 400 });
  }
  const { bookingId } = paramsValidation.data;

  try {
    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, car_id, start_date, end_date, overall_status')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      return NextResponse.json({ error: 'Booking not found to cancel' }, { status: 404 });
    }

    if (existingBooking.overall_status === 'cancelled_by_admin') {
      return NextResponse.json({ message: 'Booking already cancelled by admin', booking: existingBooking }, { status: 200 });
    }
    if (existingBooking.overall_status === 'completed' || existingBooking.overall_status === 'active_rental') {
        return NextResponse.json({ error: 'Cannot cancel booking that is active or completed'}, { status: 400 });
    }

    // 1. Update booking status
    const { data: cancelledBooking, error: cancelError } = await supabase
      .from('bookings')
      .update({ overall_status: 'cancelled_by_admin' })
      .eq('id', bookingId)
      .select('*')
      .single();

    if (cancelError || !cancelledBooking) {
      console.error('Error cancelling booking:', cancelError);
      return NextResponse.json({ error: 'Failed to cancel booking', details: cancelError?.message }, { status: 500 });
    }

    // 2. Update car_availability to 'available' for the booking period
    // Only update if status was 'booked' or 'pending_confirmation'
    const { error: availError } = await supabase
      .from('car_availability')
      .update({ status: 'available' })
      .eq('car_id', existingBooking.car_id)
      .gte('date', existingBooking.start_date)
      .lte('date', existingBooking.end_date)
      .in('status', ['booked', 'pending_confirmation']); 

    if (availError) {
      console.error('Error updating car_availability to available after cancellation:', availError);
      // Log but don't fail the entire cancellation if this part fails, as booking is already cancelled.
      // However, this could leave stale availability data.
    }

    // 3. Create audit log
    const changesMade = { 
        overall_status: { 
            old: existingBooking.overall_status, 
            new: 'cancelled_by_admin' 
        }
    };
    await supabase.from('booking_audit_logs').insert({
      booking_id: bookingId, 
      user_id: adminUserId, 
      action: 'admin_cancel', 
      changed_fields: changesMade,
      details: 'Booking cancelled by admin'
    });

    return NextResponse.json({ message: 'Booking cancelled successfully', booking: cancelledBooking });

  } catch (e: any) {
    console.error('Unexpected error in POST (cancel booking):', e);
    return NextResponse.json({ error: 'An unexpected error occurred during cancellation', details: e.message }, { status: 500 });
  }
} 