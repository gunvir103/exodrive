import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { invalidateCacheByEvent } from '@/lib/redis';
import { APP_CONFIG } from '@/lib/config/app.config';
import { logger } from '@/lib/utils/logger';
import { errorHandler } from '@/lib/utils/error-handler';

// Initialize Redis client from environment variables
let redis: Redis | null = null;
try {
  // Check if Redis is properly configured
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (redisUrl && redisToken && 
      redisUrl !== 'placeholder_redis_url' && 
      redisToken !== 'placeholder_redis_token' &&
      redisUrl.startsWith('https://')) {
    redis = Redis.fromEnv();
  } else {
    logger.warn('[API/Bookings] Redis not configured - rate limiting disabled');
  }
} catch (error) {
  logger.error('[API/Bookings] Failed to initialize Redis', error);
  redis = null;
}

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
  startDate: z.string().regex(APP_CONFIG.VALIDATION.DATE_PATTERN, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(APP_CONFIG.VALIDATION.DATE_PATTERN, "End date must be in YYYY-MM-DD format"),
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
  const lockTTL = APP_CONFIG.REDIS.LOCK_TTL; // Use config for Redis lock TTL
  const bookingLogger = logger.child('BookingAPI');

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
    // This provides an additional layer of protection at the API level
    // The primary concurrency control is now handled by the database function
    const lockKey = `booking_lock:car:${carId}:range:${startDate}_${endDate}`;
    let lockAcquired = true;
    
    if (redis) {
      lockAcquired = await redis.set(lockKey, 'locked', { nx: true, ex: lockTTL });
    }

    if (!lockAcquired) {
      // Redis lock failed - likely high concurrency
      return NextResponse.json({ 
        error: 'Multiple booking attempts detected. Please wait a moment and try again.', 
        retryable: true,
        errorCode: 'redis_lock_failed'
      }, { status: 409 }); // 409 Conflict
    }

    let bookingIdFromFunction: string | null = null;
    let customerIdFromFunction: string | null = null;

    try {
      // Prepare data for the Edge Function
      const secureTokenValue = generateSecureToken();
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Token expires in 7 days

      // Extract first and last name
      const nameParts = customerDetails.fullName.trim().split(/\s+/);
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
        bookingLogger.error('Edge function invocation error', functionError);
        // Attempt to parse error details if they are JSON string from our function's explicit error returns
        let errorDetailToShow = functionError.message;
        let userMessage = 'Booking creation failed.';
        let status = 500;
        if (functionError.context && functionError.context.details) {
            try {
                const parsedDetails = JSON.parse(functionError.context.details);
                if (parsedDetails.error) {
                    errorDetailToShow = parsedDetails.error;
                    // Handle specific error types with user-friendly messages
                    switch (parsedDetails.error) {
                        case 'dates_unavailable':
                            status = 409;
                            userMessage = 'The selected dates are no longer available.';
                            if (parsedDetails.unavailableDates) {
                                errorDetailToShow += `: ${parsedDetails.unavailableDates.join(', ')}`;
                            }
                            break;
                        case 'invalid_status_value':
                            status = 400;
                            userMessage = 'Invalid booking status provided.';
                            break;
                        case 'car_locked':
                            status = 409;
                            userMessage = 'Another booking is currently being processed for this car. Please try again in a moment.';
                            break;
                        case 'lock_timeout':
                            status = 503;
                            userMessage = 'The booking system is currently busy. Please try again in a few seconds.';
                            break;
                        default:
                            userMessage = 'An error occurred while creating your booking. Please try again.';
                    }
                }
                if (parsedDetails.details) {
                    errorDetailToShow = parsedDetails.details;
                }
            } catch (e) { /* ignore parsing error, use original message */ }
        }
        return NextResponse.json({ 
            error: userMessage, 
            details: errorDetailToShow,
            retryable: ['car_locked', 'lock_timeout'].includes(errorDetailToShow)
        }, { status });
      }

      if (!functionResponse || functionResponse.success === false) {
        bookingLogger.error('Edge function returned unsuccessful response', functionResponse);
        const errorCode = functionResponse?.error || 'unknown_error';
        let userMessage = 'Booking creation failed.';
        let status = 500;
        
        // Handle specific error types
        switch (errorCode) {
            case 'dates_unavailable':
                status = 409;
                userMessage = 'The selected dates are no longer available.';
                break;
            case 'invalid_status_value':
                status = 400;
                userMessage = 'Invalid booking status provided.';
                break;
            case 'car_locked':
                status = 409;
                userMessage = 'Another booking is currently being processed for this car. Please try again in a moment.';
                break;
            case 'lock_timeout':
                status = 503;
                userMessage = 'The booking system is currently busy. Please try again in a few seconds.';
                break;
            case 'transaction_failed':
                status = 500;
                userMessage = 'A database error occurred. Please try again or contact support if the issue persists.';
                break;
            default:
                userMessage = 'An unexpected error occurred. Please try again.';
        }
        
        return NextResponse.json({ 
            error: userMessage, 
            details: functionResponse?.details || errorCode,
            unavailableDates: functionResponse?.unavailableDates,
            retryable: ['car_locked', 'lock_timeout'].includes(errorCode),
            errorCode
        }, { status });
      }

      // Success from Edge Function
      bookingIdFromFunction = functionResponse.bookingId;
      customerIdFromFunction = functionResponse.customerId;
      // secureTokenId = functionResponse.secureTokenId;

      // Generate secure URL for the customer
      const bookingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${secureTokenValue}`;

      // Send confirmation email using enhanced service
      const { BookingEmailService } = await import('@/lib/services/booking-email-service');
      
      // Get car details for email
      const { data: carDetails } = await supabase
        .from('cars')
        .select('name, type, images')
        .eq('id', carId)
        .single();
      
      const clientIP = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
      
      // Send email asynchronously (don't await to avoid blocking response)
      BookingEmailService.sendBookingConfirmation({
        id: bookingIdFromFunction,
        customerEmail: customerDetails.email,
        customerName: customerDetails.fullName,
        carName: carDetails?.name || 'Vehicle',
        carType: carDetails?.type || 'Exotic Vehicle',
        carImage: carDetails?.images?.[0]?.url,
        startDate,
        endDate,
        totalPrice,
        basePrice: calculateTotalPrice(totalPrice / getDaysBetweenDates(startDate, endDate), 1),
        currency,
        pickupLocation: undefined, // Will show default message
        dropoffLocation: undefined, // Will show default message
        bookingUrl,
        deposit: securityDepositAmount,
        referenceNumber: `EXO-${bookingIdFromFunction.slice(0, 8).toUpperCase()}`
      }, clientIP).catch(error => {
        bookingLogger.error('Failed to send booking confirmation email', error);
      });

      // Invalidate car availability cache for this booking
      await invalidateCacheByEvent('booking.created');
      
      return NextResponse.json({
        message: 'Booking process initiated successfully!',
        bookingId: bookingIdFromFunction,
        customerId: customerIdFromFunction,
        bookingUrl,
        status: edgeFunctionPayload.initialOverallStatus, // Return initial status
      }, { status: 201 });

    } catch (error: any) {
      bookingLogger.error('Error during booking process (after lock acquisition)', error);
      const { error: sanitizedError, status } = errorHandler.formatApiError(error);
      return NextResponse.json(sanitizedError, { status });
    } finally {
      // Always release the Redis lock if Redis is available
      if (redis) {
        await redis.del(lockKey);
      }
    }

  } catch (error: any) {
    // Catches errors from request.json() or initial validation
    bookingLogger.error('Error processing booking request', error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid request payload', details: error.flatten() }, { status: 400 });
    }
    // Use the error handler for consistent error sanitization
    const { error: sanitizedError, status } = errorHandler.formatApiError(error);
    return NextResponse.json(sanitizedError, { status });
  }
} 