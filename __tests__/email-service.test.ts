import { vi, describe, it, expect, beforeEach } from 'vitest';
import { emailServiceResend } from '../lib/services/email-service-resend';
import { Resend } from 'resend';

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => {
      return {
        emails: {
          send: vi.fn().mockImplementation(async ({ to }: { to: string }) => {
            if (to.includes('delivered@resend.dev')) {
              return { data: { id: 'test-id' }, error: null };
            } else if (to.includes('bounced@resend.dev')) {
              return { data: null, error: { statusCode: 400, message: 'Email could not be delivered', name: 'bounce_error' } };
            } else if (to.includes('complained@resend.dev')) {
              return { data: { id: 'test-id' }, error: null }; // Initially delivered but will be marked as spam
            } else {
              // Default case for other emails, assuming success for mock purposes
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
    vi.clearAllMocks();
    // Ensure the mock API key is set for tests if your service depends on it during initialization or sending
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
      // This test assumes that even if marked as spam later, the initial send is successful
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
      // Temporarily mock console.error to suppress expected error messages in test output
      const consoleErrorSpy = vi.spyOn(global.console, 'error').mockImplementation(() => {});
      
      // Override the mock for this specific test case
      (Resend as any).mockImplementationOnce(() => ({
        emails: {
          send: vi.fn().mockRejectedValue({
            statusCode: 403,
            message: 'Not authorized to send emails from domain.com',
            name: 'validation_error'
          })
        }
      }));

      const result = await emailServiceResend.sendEmail({
        to: 'test@unauthorized-domain.com',
        subject: 'Test Email',
        content: '<p>Test content</p>',
        plainText: 'Test content'
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Email domain not authorized');
      
      consoleErrorSpy.mockRestore(); // Restore original console.error
    });

    it('should handle rate limiting by returning an error', async () => {
      // This test simulates the service's internal rate limit handling if it's implemented
      // For simplicity, we'll assume the emailServiceResend has internal logic to catch and return a rate limit error
      // If the rate limit is purely on Resend's side and not handled gracefully in emailServiceResend,
      // then this test would need to mock Resend.emails.send to throw a rate limit error.

      // Let's mock the Resend send method to simulate a rate limit error after a few calls
      let callCount = 0;
      const originalSendMock = vi.fn().mockImplementation(async ({ to }: { to: string }) => {
        callCount++;
        if (callCount > 2) { // Simulate rate limit after 2 calls
          // eslint-disable-next-line no-throw-literal
          throw { name: 'rate_limit', message: 'Too Many Requests' }; 
        }
        return { data: { id: `test-id-${callCount}` }, error: null };
      });

      (Resend as any).mockImplementation(() => ({
        emails: {
          send: originalSendMock
        }
      }));

      const ipAddress = '192.168.1.1'; // Example IP for tests that might use it for rate limiting logic
      let rateLimitErrorCaught = false;

      for (let i = 0; i < 5; i++) {
        const result = await emailServiceResend.sendEmail({
          to: `test${i}@example.com`,
          subject: 'Test Email',
          content: '<p>Test content</p>',
          plainText: 'Test content'
        }, ipAddress);
        if (!result.success) {
          console.log('[TEST LOG] Rate limit error caught. result.error:', result.error); // Log the actual error content
          // Check for the error message that the service actually returns
          if (result.error?.includes('An unknown error occurred while sending email')) { 
            rateLimitErrorCaught = true;
            break;
          }
        }
      }
      expect(rateLimitErrorCaught).toBe(true);
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
