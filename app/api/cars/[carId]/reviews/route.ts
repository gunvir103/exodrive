import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schema for creating a review
const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000)
});

// GET /api/cars/[carId]/reviews - Get reviews for a car
export async function GET(
  request: NextRequest,
  { params }: { params: { carId: string } }
) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  try {
    const { carId } = params;
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeUnapproved = searchParams.get('includeUnapproved') === 'true';
    
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
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
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
    
    return NextResponse.json({
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
    
  } catch (error: any) {
    console.error('Error in reviews endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/cars/[carId]/reviews - Create a review
export async function POST(
  request: NextRequest,
  { params }: { params: { carId: string } }
) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  try {
    const { carId } = params;
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get customer record
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const validationResult = createReviewSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.flatten() },
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
        { error: 'Booking not found or does not belong to customer' },
        { status: 404 }
      );
    }
    
    // Check if booking is completed
    if (booking.overall_status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only review completed bookings' },
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
        { error: 'Review already exists for this booking' },
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
      console.error('Error creating review:', createError);
      return NextResponse.json(
        { error: 'Failed to create review' },
        { status: 500 }
      );
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
    
    return NextResponse.json({
      message: 'Review submitted successfully. It will be visible after approval.',
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at
      }
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}