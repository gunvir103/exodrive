import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { withApiErrorHandling } from '@/lib/errors/error-middleware';
import { getRedisClient } from '@/lib/redis/redis-client';

// Schema for creating a review
const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000)
});

// Query parameters schema
const ReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  includeUnapproved: z.coerce.boolean().default(false)
});

// Response schemas
const ReviewResponseSchema = z.object({
  reviews: z.array(z.object({
    id: z.string().uuid(),
    carId: z.string().uuid(),
    reviewerName: z.string(),
    rating: z.number().int().min(1).max(5),
    comment: z.string(),
    isVerified: z.boolean(),
    isApproved: z.boolean(),
    createdAt: z.string(),
    customerName: z.string()
  })),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});

// GET /api/cars/[carId]/reviews - Get reviews for a car
export const GET = withApiErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) => {
  const supabase = createSupabaseServerClient(request.cookies);
  const redis = getRedisClient();
  
  const { carId } = await params;
  
  // Validate car ID
  const carIdValidation = z.string().uuid().safeParse(carId);
  if (!carIdValidation.success) {
    return NextResponse.json(
      { 
        error: 'Invalid car ID format',
        code: 'INVALID_CAR_ID'
      },
      { status: 400 }
    );
  }
  
  // Parse and validate query parameters
  const queryParams = Object.fromEntries(request.nextUrl.searchParams);
  const validatedQuery = ReviewQuerySchema.parse(queryParams);
  const { page, limit, includeUnapproved } = validatedQuery;
    
    // Create cache key based on query parameters
    const cacheKey = `reviews:car:${carId}:page:${page}:limit:${limit}:unapproved:${includeUnapproved}`;
    
    // Try to get from cache first
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('[Reviews API] Cache hit for', cacheKey);
          return NextResponse.json(cached);
        }
      } catch (cacheError) {
        console.error('[Reviews API] Cache read error:', cacheError);
        // Continue without cache on error
      }
    }
    
    // Build query
    let query = supabase
      .from('car_reviews')
      .select(`
        *,
        customer:customers (
          first_name,
          last_name
        )
      `, { count: 'exact' })
      .eq('car_id', carId)
      .order('created_at', { ascending: false });
    
    // Only show approved reviews for non-admin users
    if (!includeUnapproved) {
      query = query.eq('is_approved', true);
    } else {
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile?.role !== 'admin') {
          query = query.eq('is_approved', true);
        }
      } else {
        query = query.eq('is_approved', true);
      }
    }
    
    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
    
    const { data: reviews, error, count } = await query;
    
    if (error) {
      console.error('[Reviews] Database error:', error);
      throw new Error('Failed to fetch reviews');
    }
    
    // Format reviews
    const formattedReviews = reviews?.map(review => ({
      id: review.id,
      carId: review.car_id,
      reviewerName: review.reviewer_name,
      rating: review.rating,
      comment: review.comment,
      isVerified: review.is_verified,
      isApproved: review.is_approved,
      createdAt: review.created_at,
      customerName: review.customer ? 
        `${review.customer.first_name} ${review.customer.last_name}`.trim() : 
        review.reviewer_name
    })) || [];
    
    const response = {
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
    
    // Cache the response with 1-hour TTL
    if (redis && !includeUnapproved) { // Only cache approved reviews
      try {
        await redis.setex(cacheKey, 3600, response); // 1 hour TTL
        console.log('[Reviews API] Cached response for', cacheKey);
      } catch (cacheError) {
        console.error('[Reviews API] Cache write error:', cacheError);
        // Continue without caching on error
      }
    }
    
    // Validate response format
    const validatedResponse = ReviewResponseSchema.parse(response);
    
    return NextResponse.json(validatedResponse);
});

// POST /api/cars/[carId]/reviews - Create a review
export const POST = withApiErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) => {
  const supabase = createSupabaseServerClient(request.cookies);
  const redis = getRedisClient();
  
  const { carId } = await params;
  
  // Validate car ID
  const carIdValidation = z.string().uuid().safeParse(carId);
  if (!carIdValidation.success) {
    return NextResponse.json(
      { 
        error: 'Invalid car ID format',
        code: 'INVALID_CAR_ID'
      },
      { status: 400 }
    );
  }
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    );
  }
    
    // Get customer record
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (!customer) {
      return NextResponse.json(
        { 
          error: 'Customer profile not found',
          code: 'CUSTOMER_NOT_FOUND'
        },
        { status: 404 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const validationResult = createReviewSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      );
    }
    
    const { bookingId, rating, comment } = validationResult.data;
    
    // Verify booking exists and belongs to customer
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('customer_id', customer.id)
      .eq('car_id', carId)
      .single();
    
    if (bookingError || !booking) {
      return NextResponse.json(
        { 
          error: 'Booking not found or does not belong to customer',
          code: 'INVALID_BOOKING'
        },
        { status: 404 }
      );
    }
    
    // Check if booking is completed
    if (booking.overall_status !== 'completed') {
      return NextResponse.json(
        { 
          error: 'Can only review completed bookings',
          code: 'BOOKING_NOT_COMPLETED'
        },
        { status: 400 }
      );
    }
    
    // Check if review already exists for this booking
    const { data: existingReview } = await supabase
      .from('car_reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .single();
    
    if (existingReview) {
      return NextResponse.json(
        { 
          error: 'Review already exists for this booking',
          code: 'REVIEW_EXISTS'
        },
        { status: 409 }
      );
    }
    
    // Create review
    const { data: review, error: createError } = await supabase
      .from('car_reviews')
      .insert({
        car_id: carId,
        customer_id: customer.id,
        booking_id: bookingId,
        reviewer_name: `${customer.first_name} ${customer.last_name}`.trim(),
        rating,
        comment,
        is_verified: true, // Verified because they actually rented the car
        is_approved: false // Needs admin approval
      })
      .select()
      .single();
    
    if (createError) {
      console.error('[Reviews] Database error creating review:', createError);
      throw new Error('Failed to create review');
    }
    
    // Log event
    await supabase.from('booking_events').insert({
      booking_id: bookingId,
      event_type: 'review_submitted',
      timestamp: new Date().toISOString(),
      actor_type: 'customer',
      actor_id: customer.id,
      metadata: { review_id: review.id, rating }
    });
    
    // Invalidate cache for this car's reviews
    if (redis) {
      try {
        // Find and delete all cached entries for this car
        const pattern = `reviews:car:${carId}:*`;
        const keys = await redis.keys(pattern);
        if (keys && keys.length > 0) {
          await redis.del(...keys);
          console.log(`[Reviews API] Invalidated ${keys.length} cache entries for car ${carId}`);
        }
      } catch (cacheError) {
        console.error('[Reviews API] Cache invalidation error:', cacheError);
        // Continue even if cache invalidation fails
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully. It will be visible after approval.',
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at
      }
    }, { status: 201 });
});
