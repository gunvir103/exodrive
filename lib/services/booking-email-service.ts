import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { 
  emailServiceResend,
  type EmailSendResult,
  type BookingConfirmationData,
  type PaymentReceiptData,
  type BookingModificationData,
  type BookingCancellationData 
} from './email-service-resend';
import { logger } from '@/lib/utils/logger';

const supabase = createSupabaseServiceRoleClient();
const emailLogger = logger.child('BookingEmailService');

export interface BookingData {
  id: string;
  customerEmail: string;
  customerName: string;
  carName: string;
  carType?: string;
  carImage?: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  basePrice?: number;
  currency: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  referenceNumber?: string;
  bookingUrl?: string;
  deposit?: number;
}

export interface PaymentData {
  bookingId: string;
  transactionId: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  invoiceNumber: string;
  billingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export class BookingEmailService {
  /**
   * Send booking confirmation email with database tracking
   */
  static async sendBookingConfirmation(
    bookingData: BookingData,
    ipAddress: string = 'system'
  ): Promise<EmailSendResult> {
    const emailType = 'booking_confirmation';
    
    try {
      // Update email status to sending
      await this.updateEmailStatus(bookingData.id, emailType, 'pending');
      
      // Calculate days
      const days = Math.ceil(
        (new Date(bookingData.endDate).getTime() - new Date(bookingData.startDate).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      
      const confirmationData: BookingConfirmationData = {
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
        bookingId: bookingData.id,
        carName: bookingData.carName,
        carImage: bookingData.carImage,
        carType: bookingData.carType || 'Exotic Vehicle',
        pickupDate: bookingData.startDate,
        dropoffDate: bookingData.endDate,
        pickupLocation: bookingData.pickupLocation || "We'll contact you to arrange pickup location",
        dropoffLocation: bookingData.dropoffLocation || "Same as pickup location",
        totalPrice: bookingData.totalPrice,
        currency: bookingData.currency,
        basePrice: bookingData.basePrice || Math.floor(bookingData.totalPrice / days),
        days: days,
        deposit: bookingData.deposit,
        bookingUrl: bookingData.bookingUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingData.id}`,
        referenceNumber: bookingData.referenceNumber || `EXO-${bookingData.id.slice(0, 8).toUpperCase()}`
      };
      
      const result = await emailServiceResend.sendBookingConfirmationEmail(confirmationData, ipAddress);
      
      // Update database with result
      if (result.success) {
        await this.updateEmailStatus(bookingData.id, emailType, 'sent', result.messageId);
        await this.logBookingEvent(bookingData.id, 'email_sent', 'Booking confirmation email sent successfully', {
          emailType,
          recipientEmail: bookingData.customerEmail,
          messageId: result.messageId
        });
      } else {
        await this.updateEmailStatus(bookingData.id, emailType, 'failed', undefined, result.error);
        await this.logBookingEvent(bookingData.id, 'email_failed', 'Booking confirmation email failed to send', {
          emailType,
          recipientEmail: bookingData.customerEmail,
          error: result.error
        });
      }
      
      return result;
    } catch (error) {
      emailLogger.error('Failed to send booking confirmation email', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.updateEmailStatus(bookingData.id, emailType, 'failed', undefined, errorMessage);
      await this.logBookingEvent(bookingData.id, 'email_failed', 'Booking confirmation email failed to send', {
        emailType,
        recipientEmail: bookingData.customerEmail,
        error: errorMessage
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Send payment receipt email with database tracking
   */
  static async sendPaymentReceipt(
    bookingData: BookingData,
    paymentData: PaymentData,
    ipAddress: string = 'system'
  ): Promise<EmailSendResult> {
    const emailType = 'payment_receipt';
    
    try {
      // Update email status to sending
      await this.updateEmailStatus(bookingData.id, emailType, 'pending');
      
      const receiptData: PaymentReceiptData = {
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
        bookingId: bookingData.id,
        transactionId: paymentData.transactionId,
        carName: bookingData.carName,
        paymentAmount: paymentData.paymentAmount,
        currency: bookingData.currency,
        paymentMethod: paymentData.paymentMethod,
        paymentDate: paymentData.paymentDate,
        billingAddress: paymentData.billingAddress,
        bookingUrl: bookingData.bookingUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingData.id}`,
        invoiceNumber: paymentData.invoiceNumber
      };
      
      const result = await emailServiceResend.sendPaymentReceiptEmail(receiptData, ipAddress);
      
      // Update database with result
      if (result.success) {
        await this.updateEmailStatus(bookingData.id, emailType, 'sent', result.messageId);
        await this.logBookingEvent(bookingData.id, 'email_sent', 'Payment receipt email sent successfully', {
          emailType,
          recipientEmail: bookingData.customerEmail,
          messageId: result.messageId,
          transactionId: paymentData.transactionId
        });
      } else {
        await this.updateEmailStatus(bookingData.id, emailType, 'failed', undefined, result.error);
        await this.logBookingEvent(bookingData.id, 'email_failed', 'Payment receipt email failed to send', {
          emailType,
          recipientEmail: bookingData.customerEmail,
          error: result.error,
          transactionId: paymentData.transactionId
        });
      }
      
      return result;
    } catch (error) {
      emailLogger.error('Failed to send payment receipt email', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.updateEmailStatus(bookingData.id, emailType, 'failed', undefined, errorMessage);
      await this.logBookingEvent(bookingData.id, 'email_failed', 'Payment receipt email failed to send', {
        emailType,
        recipientEmail: bookingData.customerEmail,
        error: errorMessage,
        transactionId: paymentData.transactionId
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Send booking modification email
   */
  static async sendBookingModification(
    bookingData: BookingData,
    changes: BookingModificationData['changes'],
    modificationType: BookingModificationData['modificationType'],
    reason?: string,
    newTotalPrice?: number,
    additionalFees?: number,
    ipAddress: string = 'system'
  ): Promise<EmailSendResult> {
    const emailType = 'booking_modification';
    
    try {
      const modificationData: BookingModificationData = {
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
        bookingId: bookingData.id,
        carName: bookingData.carName,
        modificationType,
        changes,
        newTotalPrice,
        previousTotalPrice: bookingData.totalPrice,
        currency: bookingData.currency,
        effectiveDate: new Date().toISOString(),
        bookingUrl: bookingData.bookingUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingData.id}`,
        reason,
        additionalFees
      };
      
      const result = await emailServiceResend.sendBookingModificationEmail(modificationData, ipAddress);
      
      // Log the event
      if (result.success) {
        await this.logBookingEvent(bookingData.id, 'email_sent', `Booking ${modificationType} email sent successfully`, {
          emailType,
          recipientEmail: bookingData.customerEmail,
          messageId: result.messageId,
          modificationType,
          reason
        });
      } else {
        await this.logBookingEvent(bookingData.id, 'email_failed', `Booking ${modificationType} email failed to send`, {
          emailType,
          recipientEmail: bookingData.customerEmail,
          error: result.error,
          modificationType,
          reason
        });
      }
      
      return result;
    } catch (error) {
      emailLogger.error('Failed to send booking modification email', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.logBookingEvent(bookingData.id, 'email_failed', `Booking ${modificationType} email failed to send`, {
        emailType,
        recipientEmail: bookingData.customerEmail,
        error: errorMessage,
        modificationType,
        reason
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Send booking cancellation email
   */
  static async sendBookingCancellation(
    bookingData: BookingData,
    cancellationReason?: string,
    refundAmount: number = 0,
    cancellationFee: number = 0,
    isCustomerCancelled: boolean = false,
    ipAddress: string = 'system'
  ): Promise<EmailSendResult> {
    const emailType = 'booking_cancellation';
    
    try {
      const cancellationData: BookingCancellationData = {
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
        bookingId: bookingData.id,
        carName: bookingData.carName,
        carType: bookingData.carType || 'Exotic Vehicle',
        pickupDate: bookingData.startDate,
        dropoffDate: bookingData.endDate,
        totalPrice: bookingData.totalPrice,
        currency: bookingData.currency,
        cancellationDate: new Date().toISOString(),
        cancellationReason,
        refundAmount,
        refundProcessingDays: 5,
        cancellationFee: cancellationFee > 0 ? cancellationFee : undefined,
        refundMethod: 'Original Payment Method',
        isCustomerCancelled,
        referenceNumber: `CANCEL-${bookingData.id.slice(0, 8).toUpperCase()}`
      };
      
      const result = await emailServiceResend.sendBookingCancellationEmail(cancellationData, ipAddress);
      
      // Log the event
      if (result.success) {
        await this.logBookingEvent(bookingData.id, 'email_sent', 'Booking cancellation email sent successfully', {
          emailType,
          recipientEmail: bookingData.customerEmail,
          messageId: result.messageId,
          cancellationReason,
          refundAmount,
          isCustomerCancelled
        });
      } else {
        await this.logBookingEvent(bookingData.id, 'email_failed', 'Booking cancellation email failed to send', {
          emailType,
          recipientEmail: bookingData.customerEmail,
          error: result.error,
          cancellationReason,
          refundAmount,
          isCustomerCancelled
        });
      }
      
      return result;
    } catch (error) {
      emailLogger.error('Failed to send booking cancellation email', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.logBookingEvent(bookingData.id, 'email_failed', 'Booking cancellation email failed to send', {
        emailType,
        recipientEmail: bookingData.customerEmail,
        error: errorMessage,
        cancellationReason,
        refundAmount,
        isCustomerCancelled
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Retry failed email
   */
  static async retryFailedEmail(bookingId: string, emailType: string): Promise<EmailSendResult> {
    try {
      // Get booking data
      const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers(*),
          car:cars(*)
        `)
        .eq('id', bookingId)
        .single();
        
      if (error || !booking) {
        throw new Error(`Booking not found: ${bookingId}`);
      }
      
      const bookingData: BookingData = {
        id: booking.id,
        customerEmail: booking.customer.email,
        customerName: `${booking.customer.first_name} ${booking.customer.last_name}`.trim(),
        carName: booking.car.name,
        startDate: booking.start_date,
        endDate: booking.end_date,
        totalPrice: booking.total_price,
        currency: booking.currency
      };
      
      switch (emailType) {
        case 'booking_confirmation':
          return await this.sendBookingConfirmation(bookingData, 'retry');
          
        case 'payment_receipt':
          // Would need payment data from payments table
          throw new Error('Payment receipt retry not implemented - needs payment data');
          
        default:
          throw new Error(`Unsupported email type for retry: ${emailType}`);
      }
    } catch (error) {
      emailLogger.error(`Failed to retry ${emailType} email for booking ${bookingId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Update email status in database
   */
  private static async updateEmailStatus(
    bookingId: string,
    emailType: string,
    status: string,
    messageId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_booking_email_status', {
        p_booking_id: bookingId,
        p_email_type: emailType,
        p_status: status,
        p_message_id: messageId,
        p_error_message: errorMessage
      });
      
      if (error) {
        emailLogger.error('Failed to update email status', error);
      }
    } catch (error) {
      emailLogger.error('Failed to update email status', error);
    }
  }
  
  /**
   * Log booking event
   */
  private static async logBookingEvent(
    bookingId: string,
    eventType: string,
    summaryText: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('booking_events')
        .insert({
          booking_id: bookingId,
          event_type: eventType,
          summary_text: summaryText,
          details: details,
          actor_type: 'system'
        });
      
      if (error) {
        emailLogger.error('Failed to log booking event', error);
      }
    } catch (error) {
      emailLogger.error('Failed to log booking event', error);
    }
  }
  
  /**
   * Get email status for a booking
   */
  static async getEmailStatus(bookingId: string) {
    try {
      const { data, error } = await supabase
        .from('booking_email_status')
        .select('*')
        .eq('booking_id', bookingId)
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      emailLogger.error(`Failed to get email status for booking ${bookingId}`, error);
      return null;
    }
  }
  
  /**
   * Get all failed emails that need retry
   */
  static async getFailedEmails() {
    try {
      const { data, error } = await supabase
        .from('booking_email_status')
        .select('*')
        .or('email_confirmation_status.eq.failed,email_payment_receipt_status.eq.failed')
        .order('booking_created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      emailLogger.error('Failed to get failed emails', error);
      return [];
    }
  }
}