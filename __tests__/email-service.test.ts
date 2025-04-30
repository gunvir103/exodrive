import { emailServiceResend } from '@/lib/services/email-service-resend';
import { Resend } from 'resend';

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: jest.fn().mockResolvedValue({
            data: { id: 'test-email-id' },
            error: null
          })
        }
      };
    })
  };
});

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-api-key';
  });

  describe('sendEmail', () => {
    it('should successfully send an email', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: '<p>Test content</p>'
      };

      const result = await emailServiceResend.sendEmail(emailData);
      
      expect(result.success).toBe(true);
      expect(Resend).toHaveBeenCalledWith('test-api-key');
      expect(Resend.mock.instances[0].emails.send).toHaveBeenCalledWith({
        from: 'ExoDrive <onboarding@resend.dev>',
        to: ['test@example.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        replyTo: 'exodrivexotics@gmail.com'
      });
    });

    it('should handle errors when sending an email', async () => {
      const mockSendError = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Test error', statusCode: 500 }
      });

      const mockResendInstance = {
        emails: { send: mockSendError }
      };
      (Resend as jest.Mock).mockImplementation(() => mockResendInstance);

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: '<p>Test content</p>'
      };

      const result = await emailServiceResend.sendEmail(emailData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle domain authorization errors', async () => {
      const mockAuthError = jest.fn().mockRejectedValue({
        statusCode: 403,
        message: 'Not authorized to send emails from domain.com'
      });

      const mockResendInstance = {
        emails: { send: mockAuthError }
      };
      (Resend as jest.Mock).mockImplementation(() => mockResendInstance);

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: '<p>Test content</p>'
      };

      const result = await emailServiceResend.sendEmail(emailData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email domain not authorized. Please contact support.');
    });
  });

  describe('generateContactEmailHtml', () => {
    it('should generate HTML for contact form data', () => {
      const contactData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        message: 'Test message'
      };

      const html = emailServiceResend.generateContactEmailHtml(contactData);
      
      expect(html).toContain('John Doe');
      expect(html).toContain('john@example.com');
      expect(html).toContain('123-456-7890');
      expect(html).toContain('Test message');
    });

    it('should handle contact form data without phone', () => {
      const contactData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message'
      };

      const html = emailServiceResend.generateContactEmailHtml(contactData);
      
      expect(html).toContain('John Doe');
      expect(html).toContain('john@example.com');
      expect(html).not.toContain('<p><strong>Phone:</strong>');
      expect(html).toContain('Test message');
    });
  });

  describe('generateBookingConfirmationHtml', () => {
    it('should generate HTML for booking confirmation data', () => {
      const bookingData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '123-456-7890',
        carName: 'Ferrari 488',
        startDate: 'May 1, 2025',
        endDate: 'May 5, 2025',
        days: 5,
        basePrice: 1000,
        totalPrice: 5000,
        deposit: 1500
      };

      const html = emailServiceResend.generateBookingConfirmationHtml(bookingData);
      
      expect(html).toContain('John Doe');
      expect(html).toContain('Ferrari 488');
      expect(html).toContain('May 1, 2025');
      expect(html).toContain('May 5, 2025');
      expect(html).toContain('5 days');
      expect(html).toContain('$1,000');
      expect(html).toContain('$5,000');
      expect(html).toContain('$1,500');
    });

    it('should handle singular day in booking confirmation', () => {
      const bookingData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        carName: 'Ferrari 488',
        startDate: 'May 1, 2025',
        endDate: 'May 1, 2025',
        days: 1,
        basePrice: 1000,
        totalPrice: 1000,
        deposit: 300
      };

      const html = emailServiceResend.generateBookingConfirmationHtml(bookingData);
      
      expect(html).toContain('1 day');
      expect(html).not.toContain('1 days');
    });
  });
});
