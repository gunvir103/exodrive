import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import {
  renderBookingConfirmationTemplate,
  renderBookingConfirmationPlainText,
  type BookingConfirmationData
} from '@/lib/email-templates/booking-confirmation';
import {
  renderPaymentReceiptTemplate,
  renderPaymentReceiptPlainText,
  type PaymentReceiptData
} from '@/lib/email-templates/payment-receipt';
import {
  renderBookingModificationTemplate,
  renderBookingModificationPlainText,
  type BookingModificationData
} from '@/lib/email-templates/booking-modification';
import {
  renderBookingCancellationTemplate,
  renderBookingCancellationPlainText,
  type BookingCancellationData
} from '@/lib/email-templates/booking-cancellation';

// Schema for preview request
const previewSchema = z.object({
  type: z.enum(['booking_confirmation', 'payment_receipt', 'booking_modification', 'booking_cancellation']),
  format: z.enum(['html', 'text']).default('html'),
  bookingId: z.string().uuid().optional(),
  mockData: z.boolean().default(false)
});

// Mock data for testing
const getMockBookingConfirmationData = (): BookingConfirmationData => ({
  customerName: 'John Smith',
  customerEmail: 'john.smith@example.com',
  bookingId: '123e4567-e89b-12d3-a456-426614174000',
  carName: 'Lamborghini Huracán',
  carImage: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=400&h=250&fit=crop',
  carType: 'Supercar',
  pickupDate: '2024-09-15',
  dropoffDate: '2024-09-18',
  pickupLocation: 'Los Angeles International Airport (LAX)',
  dropoffLocation: 'Beverly Hills Hotel',
  totalPrice: 2400,
  currency: 'USD',
  basePrice: 800,
  days: 3,
  deposit: 2000,
  bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/sample-token`,
  referenceNumber: 'EXO-123E4567'
});

const getMockPaymentReceiptData = (): PaymentReceiptData => ({
  customerName: 'John Smith',
  customerEmail: 'john.smith@example.com',
  bookingId: '123e4567-e89b-12d3-a456-426614174000',
  transactionId: 'PAYPAL-TXN-123456789',
  carName: 'Lamborghini Huracán',
  paymentAmount: 2400,
  currency: 'USD',
  paymentMethod: 'PayPal',
  paymentDate: new Date().toISOString(),
  billingAddress: {
    name: 'John Smith',
    address: '123 Main Street',
    city: 'Beverly Hills',
    state: 'CA',
    zipCode: '90210',
    country: 'United States'
  },
  bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/sample-token`,
  invoiceNumber: 'INV-123E4567-001'
});

const getMockBookingModificationData = (): BookingModificationData => ({
  customerName: 'John Smith',
  customerEmail: 'john.smith@example.com',
  bookingId: '123e4567-e89b-12d3-a456-426614174000',
  carName: 'Lamborghini Huracán',
  modificationType: 'dates',
  changes: [
    {
      field: 'Pickup Date',
      previousValue: 'September 15, 2024',
      newValue: 'September 16, 2024'
    },
    {
      field: 'Return Date',
      previousValue: 'September 18, 2024',
      newValue: 'September 19, 2024'
    }
  ],
  newTotalPrice: 2400,
  previousTotalPrice: 2400,
  currency: 'USD',
  effectiveDate: new Date().toISOString(),
  bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/sample-token`,
  reason: 'Customer requested date change due to flight delay'
});

const getMockBookingCancellationData = (): BookingCancellationData => ({
  customerName: 'John Smith',
  customerEmail: 'john.smith@example.com',
  bookingId: '123e4567-e89b-12d3-a456-426614174000',
  carName: 'Lamborghini Huracán',
  carType: 'Supercar',
  pickupDate: '2024-09-15',
  dropoffDate: '2024-09-18',
  totalPrice: 2400,
  currency: 'USD',
  cancellationDate: new Date().toISOString(),
  cancellationReason: 'Customer requested cancellation due to personal emergency',
  refundAmount: 2200,
  refundProcessingDays: 5,
  cancellationFee: 200,
  refundMethod: 'Original Payment Method (PayPal)',
  isCustomerCancelled: true,
  referenceNumber: 'CANCEL-123E4567'
});

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  try {
    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify admin role (you may need to adjust this based on your auth setup)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const validationResult = previewSchema.safeParse({
      type: searchParams.get('type'),
      format: searchParams.get('format'),
      bookingId: searchParams.get('bookingId'),
      mockData: searchParams.get('mockData') === 'true'
    });
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validationResult.error.flatten() 
      }, { status: 400 });
    }
    
    const { type, format, bookingId, mockData } = validationResult.data;
    
    let htmlContent = '';
    let textContent = '';
    
    // If mockData is true or no bookingId provided, use mock data
    if (mockData || !bookingId) {
      switch (type) {
        case 'booking_confirmation':
          const confirmationData = getMockBookingConfirmationData();
          htmlContent = renderBookingConfirmationTemplate(confirmationData);
          textContent = renderBookingConfirmationPlainText(confirmationData);
          break;
          
        case 'payment_receipt':
          const receiptData = getMockPaymentReceiptData();
          htmlContent = renderPaymentReceiptTemplate(receiptData);
          textContent = renderPaymentReceiptPlainText(receiptData);
          break;
          
        case 'booking_modification':
          const modificationData = getMockBookingModificationData();
          htmlContent = renderBookingModificationTemplate(modificationData);
          textContent = renderBookingModificationPlainText(modificationData);
          break;
          
        case 'booking_cancellation':
          const cancellationData = getMockBookingCancellationData();
          htmlContent = renderBookingCancellationTemplate(cancellationData);
          textContent = renderBookingCancellationPlainText(cancellationData);
          break;
          
        default:
          return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
      }
    } else {
      // Get real booking data
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
      
      // Convert to template data format
      switch (type) {
        case 'booking_confirmation':
          const realConfirmationData: BookingConfirmationData = {
            customerName: `${booking.customer.first_name} ${booking.customer.last_name}`.trim(),
            customerEmail: booking.customer.email,
            bookingId: booking.id,
            carName: booking.car.name,
            carType: booking.car.type || 'Exotic Vehicle',
            carImage: booking.car.images?.[0]?.url,
            pickupDate: booking.start_date,
            dropoffDate: booking.end_date,
            totalPrice: booking.total_price,
            currency: booking.currency,
            basePrice: Math.floor(booking.total_price / 
              (Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
            ),
            days: Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1,
            bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingId}`,
            referenceNumber: `EXO-${booking.id.slice(0, 8).toUpperCase()}`
          };
          htmlContent = renderBookingConfirmationTemplate(realConfirmationData);
          textContent = renderBookingConfirmationPlainText(realConfirmationData);
          break;
          
        default:
          return NextResponse.json({ 
            error: 'Real data preview only supported for booking_confirmation currently' 
          }, { status: 400 });
      }
    }
    
    // Return the appropriate format
    if (format === 'text') {
      return new Response(textContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        }
      });
    } else {
      return new Response(htmlContent, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        }
      });
    }
    
  } catch (error) {
    console.error('Email preview error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate email preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

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
    const sendTestSchema = z.object({
      type: z.enum(['booking_confirmation', 'payment_receipt', 'booking_modification', 'booking_cancellation']),
      recipientEmail: z.string().email(),
      bookingId: z.string().uuid().optional(),
      mockData: z.boolean().default(true)
    });
    
    const validationResult = sendTestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validationResult.error.flatten() 
      }, { status: 400 });
    }
    
    const { type, recipientEmail, mockData } = validationResult.data;
    
    // Import email service
    const { emailServiceResend } = await import('@/lib/services/email-service-resend');
    
    let result;
    
    switch (type) {
      case 'booking_confirmation':
        const confirmationData = getMockBookingConfirmationData();
        confirmationData.customerEmail = recipientEmail; // Override email for test
        result = await emailServiceResend.sendBookingConfirmationEmail(confirmationData, 'admin-test');
        break;
        
      case 'payment_receipt':
        const receiptData = getMockPaymentReceiptData();
        receiptData.customerEmail = recipientEmail;
        result = await emailServiceResend.sendPaymentReceiptEmail(receiptData, 'admin-test');
        break;
        
      case 'booking_modification':
        const modificationData = getMockBookingModificationData();
        modificationData.customerEmail = recipientEmail;
        result = await emailServiceResend.sendBookingModificationEmail(modificationData, 'admin-test');
        break;
        
      case 'booking_cancellation':
        const cancellationData = getMockBookingCancellationData();
        cancellationData.customerEmail = recipientEmail;
        result = await emailServiceResend.sendBookingCancellationEmail(cancellationData, 'admin-test');
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Test ${type} email sent to ${recipientEmail}`,
        messageId: result.messageId
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Test email send error:', error);
    return NextResponse.json({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}