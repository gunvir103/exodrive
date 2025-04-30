import { Resend } from 'resend';

export type EmailTemplateData = {
  from?: string;
  to: string;
  subject: string;
  content: string;
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
   * Send an email using Resend
   */
  sendEmail: async (emailData: EmailTemplateData): Promise<{ success: boolean; error?: string }> => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    try {
      const { data, error } = await resend.emails.send({
        from: emailData.from || 'ExoDrive <noreply@exodrive.app>', // Default sender
        to: [emailData.to],
        subject: emailData.subject,
        html: emailData.content,
        reply_to: emailData.replyTo || 'info@exodrive.app',
      });

      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
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
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">${data.message.replace(/\n/g, '<br/>')}</p>
      </div>
    `;
  },

  /**
   * Generate HTML content for booking confirmation
   */
  generateBookingConfirmationHtml: (data: BookingConfirmationData): string => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your ExoDrive Booking Confirmation</h2>
        <p>Hello ${data.customerName},</p>
        <p>Thank you for booking with ExoDrive! Your exotic car rental request has been received.</p>
        
        <h3 style="margin-top: 20px;">Booking Details:</h3>
        <p><strong>Vehicle:</strong> ${data.carName}</p>
        <p><strong>Rental Period:</strong> ${data.startDate} to ${data.endDate} (${data.days} day${data.days !== 1 ? 's' : ''})</p>
        <p><strong>Daily Rate:</strong> $${data.basePrice.toLocaleString()}</p>
        <p><strong>Total:</strong> $${data.totalPrice.toLocaleString()}</p>
        <p><strong>Deposit (Due Now):</strong> $${data.deposit.toLocaleString()}</p>
        
        <p style="margin-top: 20px;">Our team will contact you shortly to finalize your reservation and arrange for payment.</p>
        
        <p style="margin-top: 30px;">Thank you for choosing ExoDrive!</p>
        <p>- The ExoDrive Team</p>
      </div>
    `;
  }
};
