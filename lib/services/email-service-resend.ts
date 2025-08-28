import { Resend } from 'resend';
import { renderContactTemplate, renderContactPlainText } from '../email-templates/contact-template';
import { renderBookingTemplate, renderBookingPlainText } from '../email-templates/booking-template';
import { 
  renderBookingConfirmationTemplate, 
  renderBookingConfirmationPlainText,
  type BookingConfirmationData as NewBookingConfirmationData
} from '../email-templates/booking-confirmation';
import {
  renderPaymentReceiptTemplate,
  renderPaymentReceiptPlainText,
  type PaymentReceiptData
} from '../email-templates/payment-receipt';
import {
  renderBookingModificationTemplate,
  renderBookingModificationPlainText,
  type BookingModificationData
} from '../email-templates/booking-modification';
import {
  renderBookingCancellationTemplate,
  renderBookingCancellationPlainText,
  type BookingCancellationData
} from '../email-templates/booking-cancellation';

type RateLimitRecord = {
  count: number;
  timestamp: number;
};

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const RATE_LIMIT_MAX = 10; // Maximum 10 emails per minute
const rateLimitStore: Record<string, RateLimitRecord> = {};

export type EmailTemplateData = {
  from?: string;
  to: string;
  subject: string;
  content: string;
  plainText?: string;
  replyTo?: string;
};

export type ContactFormData = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

export type LegacyBookingConfirmationData = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  carName: string;
  startDate: string;
  endDate: string;
  days: number;
  basePrice: number;
  totalPrice: number;
  deposit: number;
};

export type EmailSendResult = {
  success: boolean;
  error?: string;
  messageId?: string;
};

export type EmailRetryConfig = {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
};

export type EmailEventData = {
  bookingId?: string;
  emailType: string;
  recipientEmail: string;
  status: 'sent' | 'failed' | 'retrying';
  error?: string;
  messageId?: string;
  attemptCount: number;
};

export const emailServiceResend = {
  /**
   * Check if the request is rate limited
   */
  isRateLimited: (ipAddress: string): boolean => {
    const now = Date.now();
    const record = rateLimitStore[ipAddress];

    if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitStore[ipAddress] = { count: 1, timestamp: now };
      return false;
    }

    if (record.count < RATE_LIMIT_MAX) {
      record.count += 1;
      return false;
    }

    return true;
  },

  /**
   * Send an email using Resend with retry logic
   */
  sendEmailWithRetry: async (
    emailData: EmailTemplateData, 
    ipAddress: string = 'unknown',
    retryConfig: EmailRetryConfig = { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 }
  ): Promise<EmailSendResult> => {
    let lastError: any;
    
    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await emailServiceResend.sendEmail(emailData, ipAddress);
        if (result.success) {
          return { success: true, messageId: result.messageId };
        }
        lastError = new Error(result.error || 'Unknown error');
      } catch (error) {
        lastError = error;
        console.error(`Email send attempt ${attempt} failed:`, error);
        
        if (attempt < retryConfig.maxRetries) {
          const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    return {
      success: false,
      error: lastError instanceof Error ? lastError.message : 'Failed after all retry attempts'
    };
  },

  /**
   * Send an email using Resend (original method)
   */
  sendEmail: async (emailData: EmailTemplateData, ipAddress: string = 'unknown'): Promise<{ success: boolean; error?: string; messageId?: string }> => {
    if (emailServiceResend.isRateLimited(ipAddress)) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const { data, error } = await resend.emails.send({
        from: emailData.from || 'ExoDrive <BookingSolutions@exodrive.co>', // Default sender using verified domain
        to: [emailData.to],
        subject: emailData.subject,
        html: emailData.content,
        text: emailData.plainText, // Plain text version for accessibility
        replyTo: emailData.replyTo || 'exodrivexotics@gmail.com', // Fixed property name and email
      });

      if (error) {
        console.error('Resend API error:', error);
        throw error;
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Error sending email:', error);

      if (typeof error === 'object' && error !== null) {
        const resendError = error as any;

        if (resendError.statusCode === 403 && resendError.message?.includes('Not authorized')) {
          return {
            success: false,
            error: 'Email domain not authorized. Please contact support.'
          };
        }

        if (resendError.statusCode === 429) {
          return {
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred while sending email'
      };
    }
  },

  /**
   * Generate HTML content for contact form submission
   */
  generateContactEmailHtml: (data: ContactFormData): string => {
    return renderContactTemplate(data);
  },

  /**
   * Generate plain text content for contact form submission
   */
  generateContactEmailPlainText: (data: ContactFormData): string => {
    return renderContactPlainText(data);
  },

  /**
   * Generate HTML content for booking confirmation (legacy)
   */
  generateBookingConfirmationHtml: (data: LegacyBookingConfirmationData): string => {
    return renderBookingTemplate(data as any);
  },

  /**
   * Generate plain text content for booking confirmation (legacy)
   */
  generateBookingConfirmationPlainText: (data: LegacyBookingConfirmationData): string => {
    return renderBookingPlainText(data as any);
  },

  /**
   * Send enhanced booking confirmation email
   */
  sendBookingConfirmationEmail: async (
    data: NewBookingConfirmationData,
    ipAddress: string = 'unknown'
  ): Promise<EmailSendResult> => {
    const emailData: EmailTemplateData = {
      to: data.customerEmail,
      subject: `Booking Confirmed - ${data.carName} | ExoDrive`,
      content: renderBookingConfirmationTemplate(data),
      plainText: renderBookingConfirmationPlainText(data),
      from: 'ExoDrive <bookings@exodrive.co>',
      replyTo: 'support@exodrive.co'
    };

    return await emailServiceResend.sendEmailWithRetry(emailData, ipAddress);
  },

  /**
   * Send payment receipt email
   */
  sendPaymentReceiptEmail: async (
    data: PaymentReceiptData,
    ipAddress: string = 'unknown'
  ): Promise<EmailSendResult> => {
    const emailData: EmailTemplateData = {
      to: data.customerEmail,
      subject: `Payment Receipt - ${data.carName} | ExoDrive`,
      content: renderPaymentReceiptTemplate(data),
      plainText: renderPaymentReceiptPlainText(data),
      from: 'ExoDrive <payments@exodrive.co>',
      replyTo: 'support@exodrive.co'
    };

    return await emailServiceResend.sendEmailWithRetry(emailData, ipAddress);
  },

  /**
   * Send booking modification email
   */
  sendBookingModificationEmail: async (
    data: BookingModificationData,
    ipAddress: string = 'unknown'
  ): Promise<EmailSendResult> => {
    const emailData: EmailTemplateData = {
      to: data.customerEmail,
      subject: `Booking ${data.modificationType === 'cancellation' ? 'Cancelled' : 'Modified'} - ${data.carName} | ExoDrive`,
      content: renderBookingModificationTemplate(data),
      plainText: renderBookingModificationPlainText(data),
      from: 'ExoDrive <bookings@exodrive.co>',
      replyTo: 'support@exodrive.co'
    };

    return await emailServiceResend.sendEmailWithRetry(emailData, ipAddress);
  },

  /**
   * Send booking cancellation email
   */
  sendBookingCancellationEmail: async (
    data: BookingCancellationData,
    ipAddress: string = 'unknown'
  ): Promise<EmailSendResult> => {
    const emailData: EmailTemplateData = {
      to: data.customerEmail,
      subject: `Booking Cancelled - ${data.carName} | ExoDrive`,
      content: renderBookingCancellationTemplate(data),
      plainText: renderBookingCancellationPlainText(data),
      from: 'ExoDrive <bookings@exodrive.co>',
      replyTo: 'support@exodrive.co'
    };

    return await emailServiceResend.sendEmailWithRetry(emailData, ipAddress);
  },

  /**
   * Log email event to database (for tracking)
   */
  logEmailEvent: async (eventData: EmailEventData): Promise<void> => {
    try {
      // This would typically log to your database
      console.log('Email event logged:', {
        timestamp: new Date().toISOString(),
        ...eventData
      });
      
      // If you have access to Supabase client here, you can log to booking_events
      // await supabase.from('booking_events').insert({
      //   booking_id: eventData.bookingId,
      //   event_type: `email_${eventData.status}`,
      //   summary_text: `Email ${eventData.emailType} ${eventData.status}`,
      //   details: {
      //     emailType: eventData.emailType,
      //     recipientEmail: eventData.recipientEmail,
      //     messageId: eventData.messageId,
      //     error: eventData.error,
      //     attemptCount: eventData.attemptCount
      //   },
      //   actor_type: 'system'
      // });
    } catch (error) {
      console.error('Failed to log email event:', error);
    }
  }
};

// Re-export types for external use
export type { NewBookingConfirmationData as BookingConfirmationData, PaymentReceiptData, BookingModificationData, BookingCancellationData };
