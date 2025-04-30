import { Resend } from 'resend';
import { renderContactTemplate, renderContactPlainText } from '../email-templates/contact-template';
import { renderBookingTemplate, renderBookingPlainText } from '../email-templates/booking-template';

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

export type BookingConfirmationData = {
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
   * Send an email using Resend
   */
  sendEmail: async (emailData: EmailTemplateData, ipAddress: string = 'unknown'): Promise<{ success: boolean; error?: string }> => {
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
      
      return { success: true };
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
   * Generate HTML content for booking confirmation
   */
  generateBookingConfirmationHtml: (data: BookingConfirmationData): string => {
    return renderBookingTemplate(data);
  },

  /**
   * Generate plain text content for booking confirmation
   */
  generateBookingConfirmationPlainText: (data: BookingConfirmationData): string => {
    return renderBookingPlainText(data);
  }
};
