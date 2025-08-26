import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { BookingEmailService } from '@/lib/services/booking-email-service';

const resendSchema = z.object({
  bookingId: z.string().uuid(),
  emailType: z.enum(['booking_confirmation', 'payment_receipt']),
  reason: z.string().optional()
});

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
    const validationResult = resendSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validationResult.error.flatten() 
      }, { status: 400 });
    }
    
    const { bookingId, emailType, reason } = validationResult.data;
    
    // Get booking details first
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        car:cars(*)
      `)
      .eq('id', bookingId)
      .single();
    
    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    
    // Log the resend attempt
    await supabase
      .from('booking_events')
      .insert({
        booking_id: bookingId,
        event_type: 'admin_action',
        actor_type: 'admin',
        actor_id: user.id,
        actor_name: user.email,
        summary_text: `Admin manually resending ${emailType} email`,
        details: {
          emailType,
          reason: reason || 'Manual resend by admin',
          adminUserId: user.id
        }
      });
    
    let result;
    
    switch (emailType) {
      case 'booking_confirmation':
        result = await BookingEmailService.sendBookingConfirmation({
          id: booking.id,
          customerEmail: booking.customer.email,
          customerName: `${booking.customer.first_name} ${booking.customer.last_name}`.trim(),
          carName: booking.car.name,
          carType: booking.car.type || 'Exotic Vehicle',
          carImage: booking.car.images?.[0]?.url,
          startDate: booking.start_date,
          endDate: booking.end_date,
          totalPrice: booking.total_price,
          currency: booking.currency,
          bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingId}`,
          referenceNumber: `EXO-${booking.id.slice(0, 8).toUpperCase()}`
        }, 'admin-resend');
        break;
        
      case 'payment_receipt':
        // Get payment details
        const { data: payment } = await supabase
          .from('payments')
          .select('*')
          .eq('booking_id', bookingId)
          .eq('status', 'captured')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!payment) {
          return NextResponse.json({ 
            error: 'No captured payment found for this booking' 
          }, { status: 400 });
        }
        
        result = await BookingEmailService.sendPaymentReceipt(
          {
            id: booking.id,
            customerEmail: booking.customer.email,
            customerName: `${booking.customer.first_name} ${booking.customer.last_name}`.trim(),
            carName: booking.car.name,
            carType: booking.car.type,
            startDate: booking.start_date,
            endDate: booking.end_date,
            totalPrice: booking.total_price,
            currency: booking.currency,
            bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingId}`
          },
          {
            bookingId,
            transactionId: payment.paypal_authorization_id || payment.id,
            paymentAmount: payment.amount,
            paymentMethod: 'PayPal',
            paymentDate: payment.captured_at || payment.created_at,
            invoiceNumber: `INV-${booking.id.slice(0, 8).toUpperCase()}-${payment.id.slice(0, 8).toUpperCase()}`
          },
          'admin-resend'
        );
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }
    
    if (result.success) {
      // Log successful resend
      await supabase
        .from('booking_events')
        .insert({
          booking_id: bookingId,
          event_type: 'email_sent',
          actor_type: 'admin',
          actor_id: user.id,
          actor_name: user.email,
          summary_text: `${emailType} email successfully resent by admin`,
          details: {
            emailType,
            messageId: result.messageId,
            isResend: true,
            reason: reason || 'Manual resend by admin'
          }
        });
      
      return NextResponse.json({
        success: true,
        message: `${emailType} email resent successfully`,
        messageId: result.messageId
      });
    } else {
      // Log failed resend
      await supabase
        .from('booking_events')
        .insert({
          booking_id: bookingId,
          event_type: 'email_failed',
          actor_type: 'admin',
          actor_id: user.id,
          actor_name: user.email,
          summary_text: `Failed to resend ${emailType} email`,
          details: {
            emailType,
            error: result.error,
            isResend: true,
            reason: reason || 'Manual resend by admin'
          }
        });
      
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Email resend error:', error);
    return NextResponse.json({
      error: 'Failed to resend email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}