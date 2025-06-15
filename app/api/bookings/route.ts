import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

// Initialize Redis client from environment variables
const redis = Redis.fromEnv();

// ---- Helper Functions ----
function generateSecureToken(length = 48) {
  return crypto.randomBytes(length).toString('hex');
}

// NOTE: calculateTotalPrice might still be useful for pre-calculation on the client or initial estimate,
// but the definitive price calculation for the booking should ideally also be part of the
// transactional PL/pgSQL function or validated server-side before calling the function
// to ensure consistency, especially if complex pricing rules exist.
// For now, we assume it's calculated correctly on the client/Next.js backend before calling the Edge Function.
function calculateTotalPrice(basePrice: number, days: number, discountPercentage?: number | null): number {
  let price = basePrice * days;
  if (discountPercentage && discountPercentage > 0 && discountPercentage <= 100) {
    price = price * (1 - discountPercentage / 100);
  }
  return price;
}

function getDaysBetweenDates(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Inclusive of start and end day
}

// ---- Request Schema ----
const customerSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters long"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(), // Assuming phone is optional
});

const bookingRequestSchema = z.object({
  carId: z.string().uuid("Invalid car ID"),
  startDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "End date must be in YYYY-MM-DD format"),
  customerDetails: customerSchema,
  // Optional: Add basePrice, discount if these are sent from client to calculate total here.
  // Or, ensure totalPrice is calculated securely based on carId and dates via another mechanism.
  totalPrice: z.number().positive("Total price must be a positive number"),
  currency: z.string().length(3, "Currency code must be 3 characters"), // e.g., USD
  securityDepositAmount: z.number().nonnegative("Security deposit must be non-negative"),
});

// ---- Main POST Handler ----
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  const lockTTL = 30; // seconds for Redis lock

  try {
    const body = await request.json();
    const validationResult = bookingRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: validationResult.error.flatten() }, { status: 400 });
    }

    const {
      carId,
      startDate,
      endDate,
      customerDetails,
      totalPrice,
      currency,
      securityDepositAmount,
    } = validationResult.data;

    // Basic date validation (more can be added)
    if (new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
    }
    const bookingDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    if (bookingDays <= 0) {
        return NextResponse.json({ error: 'Booking must be for at least one day' }, { status: 400 });
    }

    // Acquire Redis Lock for carId and date range
    // A more robust lock key might include specific dates if granularity allows
    const lockKey = `booking_lock:car:${carId}:range:${startDate}_${endDate}`;
    const lockAcquired = await redis.set(lockKey, 'locked', { nx: true, ex: lockTTL });

    if (!lockAcquired) {
      return NextResponse.json({ error: 'Failed to acquire booking lock, car availability might be changing. Please try again.' }, { status: 409 }); // 409 Conflict
    }

    let bookingIdFromFunction: string | null = null;
    let customerIdFromFunction: string | null = null;

    try {
      // Prepare data for the Edge Function
      const secureTokenValue = generateSecureToken();
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Token expires in 7 days

      // Extract first and last name
      const nameParts = customerDetails.fullName.trim().split(/\\s+/);
      const firstName = nameParts.shift() || '';
      const lastName = nameParts.join(' ') || '';

      const edgeFunctionPayload = {
        carId,
        startDate,
        endDate,
        customerDetails: {
            firstName,
            lastName,
            email: customerDetails.email,
            phone: customerDetails.phone,
        },
        totalPrice,
        currency,
        securityDepositAmount,
        secureTokenValue,
        tokenExpiresAt,
        bookingDays,
        initialOverallStatus: 'pending_payment', // Or 'pending_customer_action'
        initialPaymentStatus: 'pending',
        initialContractStatus: 'not_sent',
      };

      // Invoke Supabase Edge Function
      const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
        'create-booking-transaction',
        { body: edgeFunctionPayload }
      );

      if (functionError) {
        console.error('Edge function invocation error:', functionError);
        // Attempt to parse error details if they are JSON string from our function's explicit error returns
        let errorDetailToShow = functionError.message;
        let status = 500;
        if (functionError.context && functionError.context.details) {
            try {
                const parsedDetails = JSON.parse(functionError.context.details);
                if (parsedDetails.error) errorDetailToShow = parsedDetails.error;
                if (parsedDetails.unavailableDates) errorDetailToShow += `: ${parsedDetails.unavailableDates.join(', ')}`;
                if (parsedDetails.error === 'dates_unavailable') status = 409;
                if (parsedDetails.error === 'invalid_status_value') status = 400;
            } catch (e) { /* ignore parsing error, use original message */ }
        }
        return NextResponse.json({ error: 'Booking creation failed via Edge Function.', details: errorDetailToShow }, { status });
      }

      if (!functionResponse || functionResponse.success === false) {
        console.error('Edge function returned unsuccessful response:', functionResponse);
        const errorMsg = functionResponse?.error || 'Unknown error from edge function.';
        const status = functionResponse?.error === 'dates_unavailable' ? 409 : (functionResponse?.error === 'invalid_status_value' ? 400 : 500) ;
        return NextResponse.json({ error: 'Booking creation failed.', details: errorMsg, data:functionResponse }, { status });
      }

      // Success from Edge Function
      bookingIdFromFunction = functionResponse.bookingId;
      customerIdFromFunction = functionResponse.customerId;
      // secureTokenId = functionResponse.secureTokenId;

      // Generate secure URL for the customer
      const bookingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${secureTokenValue}`;

      // Send confirmation email
      const { sendBookingConfirmationEmail } = await import('@/lib/email/booking-emails');
      
      // Get car details for email
      const { data: carDetails } = await supabase
        .from('cars')
        .select('name')
        .eq('id', carId)
        .single();
      
      // Send email asynchronously (don't await to avoid blocking response)
      sendBookingConfirmationEmail({
        customerEmail: customerDetails.email,
        customerName: customerDetails.fullName,
        bookingId: bookingIdFromFunction,
        carName: carDetails?.name || 'Vehicle',
        startDate,
        endDate,
        totalPrice,
        currency,
        bookingUrl
      }).catch(error => {
        console.error('Failed to send booking confirmation email:', error);
        // Log to booking events
        supabase.from('booking_events').insert({
          booking_id: bookingIdFromFunction,
          event_type: 'email_send_failed',
          timestamp: new Date().toISOString(),
          actor_type: 'system',
          metadata: { error: error.message, email_type: 'booking_confirmation' }
        });
      });

      return NextResponse.json({
        message: 'Booking process initiated successfully!',
        bookingId: bookingIdFromFunction,
        customerId: customerIdFromFunction,
        bookingUrl,
        status: edgeFunctionPayload.initialOverallStatus, // Return initial status
      }, { status: 201 });

    } catch (error: any) {
      console.error('Error during booking process (after lock acquisition):', error);
      return NextResponse.json({ error: 'An unexpected error occurred during booking.', details: error.message }, { status: 500 });
    } finally {
      // Always release the Redis lock
      await redis.del(lockKey);
    }

  } catch (error: any) {
    // Catches errors from request.json() or initial validation
    console.error('Error processing booking request:', error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid request payload', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to process booking request.', details: error.message }, { status: 500 });
  }
} 