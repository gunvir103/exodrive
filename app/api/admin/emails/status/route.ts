import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const statusQuerySchema = z.object({
  bookingId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  status: z.enum(['all', 'failed', 'sent', 'pending']).default('all'),
  type: z.enum(['all', 'booking_confirmation', 'payment_receipt']).default('all')
});

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  try {
    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const validationResult = statusQuerySchema.safeParse({
      bookingId: searchParams.get('bookingId'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      type: searchParams.get('type')
    });
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validationResult.error.flatten() 
      }, { status: 400 });
    }
    
    const { bookingId, page, limit, status, type } = validationResult.data;
    const offset = (page - 1) * limit;
    
    if (bookingId) {
      // Get specific booking email status
      const { data: bookingStatus, error } = await supabase
        .from('booking_email_status')
        .select('*')
        .eq('booking_id', bookingId)
        .single();
        
      if (error) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      
      // Get detailed email events for this booking
      const { data: emailEvents } = await supabase
        .from('email_events')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });
      
      return NextResponse.json({
        booking: bookingStatus,
        emailEvents: emailEvents || []
      });
    }
    
    // Build query for listing bookings with email status
    let query = supabase
      .from('booking_email_status')
      .select('*', { count: 'exact' });
    
    // Apply status filter
    if (status !== 'all') {
      if (type === 'booking_confirmation' || type === 'all') {
        query = query.or(`email_confirmation_status.eq.${status}`);
      }
      if (type === 'payment_receipt' || type === 'all') {
        query = query.or(`email_payment_receipt_status.eq.${status}`);
      }
    }
    
    // Apply pagination
    const { data: bookings, error, count } = await query
      .order('booking_created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw error;
    }
    
    // Get summary statistics
    const { data: stats } = await supabase.rpc('get_email_stats');
    
    const totalPages = count ? Math.ceil(count / limit) : 0;
    
    return NextResponse.json({
      bookings: bookings || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats: stats || {
        total_bookings: 0,
        confirmation_emails_sent: 0,
        confirmation_emails_failed: 0,
        payment_emails_sent: 0,
        payment_emails_failed: 0
      }
    });
    
  } catch (error) {
    console.error('Email status fetch error:', error);
    return NextResponse.json({
      error: 'Failed to fetch email status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Batch retry failed emails
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  try {
    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    const retrySchema = z.object({
      action: z.literal('retry_failed'),
      emailType: z.enum(['booking_confirmation', 'payment_receipt', 'all']).default('all'),
      maxRetries: z.number().min(1).max(10).default(5)
    });
    
    const validationResult = retrySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validationResult.error.flatten() 
      }, { status: 400 });
    }
    
    const { emailType, maxRetries } = validationResult.data;
    
    // Get failed emails
    const { BookingEmailService } = await import('@/lib/services/booking-email-service');
    const failedEmails = await BookingEmailService.getFailedEmails();
    
    let filteredEmails = failedEmails;
    if (emailType !== 'all') {
      filteredEmails = failedEmails.filter(booking => {
        if (emailType === 'booking_confirmation') {
          return booking.email_confirmation_status === 'failed';
        } else if (emailType === 'payment_receipt') {
          return booking.email_payment_receipt_status === 'failed';
        }
        return false;
      });
    }
    
    const results = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Limit the number of retries to prevent overwhelming the system
    const emailsToRetry = filteredEmails.slice(0, maxRetries);
    
    for (const booking of emailsToRetry) {
      try {
        results.attempted++;
        
        // Retry confirmation email if failed
        if (booking.email_confirmation_status === 'failed' && 
            (emailType === 'all' || emailType === 'booking_confirmation')) {
          const result = await BookingEmailService.retryFailedEmail(
            booking.booking_id, 
            'booking_confirmation'
          );
          
          if (result.success) {
            results.succeeded++;
          } else {
            results.failed++;
            results.errors.push(`Booking ${booking.booking_id}: ${result.error}`);
          }
        }
        
        // Add small delay to avoid rate limiting
        if (results.attempted < emailsToRetry.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Booking ${booking.booking_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Log the batch retry
    await supabase
      .from('booking_events')
      .insert({
        event_type: 'admin_action',
        actor_type: 'admin',
        actor_id: user.id,
        actor_name: user.email,
        summary_text: `Admin performed batch email retry`,
        details: {
          action: 'batch_retry',
          emailType,
          results,
          maxRetries
        }
      });
    
    return NextResponse.json({
      success: true,
      message: `Batch retry completed: ${results.succeeded} succeeded, ${results.failed} failed`,
      results
    });
    
  } catch (error) {
    console.error('Batch retry error:', error);
    return NextResponse.json({
      error: 'Failed to perform batch retry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}