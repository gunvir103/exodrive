import { jest } from '@jest/globals';
import { emailServiceResend } from '../lib/services/email-service-resend';

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: jest.fn().mockImplementation(async ({ to }) => {
            if (to.includes('delivered@resend.dev')) {
              return { data: { id: 'test-id' }, error: null };
            } else if (to.includes('bounced@resend.dev')) {
              return { data: null, error: { statusCode: 400, message: 'Email could not be delivered', name: 'bounce_error' } };
            } else if (to.includes('complained@resend.dev')) {
              return { data: { id: 'test-id' }, error: null }; // Initially delivered but will be marked as spam
            } else {
              return { data: { id: 'test-id' }, error: null };
            }
          }),
        },
      };
    }),
  };
});

describe('Email Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.RESEND_API_KEY = 'test-api-key';
  });

  describe('sendEmail', () => {
    it('should successfully send an email to delivered@resend.dev', async () => {
      const result = await emailServiceResend.sendEmail({
        to: 'delivered@resend.dev',
        subject: 'Test Email',
        content: '<p>Test content</p>',
        plainText: 'Test content'
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle bounced emails with bounced@resend.dev', async () => {
      const result = await emailServiceResend.sendEmail({
        to: 'bounced@resend.dev',
        subject: 'Test Email',
        content: '<p>Test content</p>',
        plainText: 'Test content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle emails marked as spam with complained@resend.dev', async () => {
      const result = await emailServiceResend.sendEmail({
        to: 'complained@resend.dev',
        subject: 'Test Email',
        content: '<p>Test content</p>',
        plainText: 'Test content'
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle domain authorization errors', async () => {
      jest.spyOn(global.console, 'error').mockImplementation(() => {});
      
      const mockResend = require('resend').Resend;
      mockResend.mockImplementationOnce(() => ({
        emails: {
          send: jest.fn().mockRejectedValue({
            statusCode: 403,
            message: 'Not authorized to send emails from domain.com',
            name: 'validation_error'
          })
        }
      }));

      const result = await emailServiceResend.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        content: '<p>Test content</p>',
        plainText: 'Test content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email domain not authorized');
    });

    it('should handle rate limiting', async () => {
      const ipAddress = '192.168.1.1';
      
      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          emailServiceResend.sendEmail({
            to: 'test@example.com',
            subject: 'Test Email',
            content: '<p>Test content</p>',
            plainText: 'Test content'
          }, ipAddress)
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results.some(r => !r.success && r.error?.includes('Rate limit'))).toBe(true);
    });
  });

  describe('Email Template Generation', () => {
    it('should generate HTML content for contact form submission', () => {
      const contactData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '123-456-7890',
        message: 'This is a test message'
      };
      
      const html = emailServiceResend.generateContactEmailHtml(contactData);
      
      expect(html).toContain(contactData.name);
      expect(html).toContain(contactData.email);
      expect(html).toContain(contactData.phone);
      expect(html).toContain(contactData.message);
    });
    
    it('should generate HTML content for booking confirmation', () => {
      const bookingData = {
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: '123-456-7890',
        carName: 'Test Car',
        startDate: '2023-01-01',
        endDate: '2023-01-05',
        days: 5,
        basePrice: 1000,
        totalPrice: 5000,
        deposit: 1000
      };
      
      const html = emailServiceResend.generateBookingConfirmationHtml(bookingData);
      
      expect(html).toContain(bookingData.customerName);
      expect(html).toContain(bookingData.carName);
      expect(html).toContain(bookingData.startDate);
      expect(html).toContain(bookingData.endDate);
    });
  });
});
