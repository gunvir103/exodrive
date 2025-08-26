/**
 * Email System Integration Test
 * 
 * This test verifies that the email system is properly integrated
 * and can generate email templates correctly.
 */

import { describe, it, expect } from 'bun:test';
import {
  renderBookingConfirmationTemplate,
  renderBookingConfirmationPlainText,
  type BookingConfirmationData
} from '../lib/email-templates/booking-confirmation';
import {
  renderPaymentReceiptTemplate,
  renderPaymentReceiptPlainText,
  type PaymentReceiptData
} from '../lib/email-templates/payment-receipt';
import { emailServiceResend } from '../lib/services/email-service-resend';

const mockBookingData: BookingConfirmationData = {
  customerName: 'John Doe',
  customerEmail: 'john.doe@example.com',
  bookingId: '123e4567-e89b-12d3-a456-426614174000',
  carName: 'Lamborghini Huracán',
  carImage: 'https://example.com/car.jpg',
  carType: 'Supercar',
  pickupDate: '2024-09-15',
  dropoffDate: '2024-09-18',
  pickupLocation: 'Los Angeles Airport',
  dropoffLocation: 'Beverly Hills',
  totalPrice: 2400,
  currency: 'USD',
  basePrice: 800,
  days: 3,
  deposit: 2000,
  bookingUrl: 'https://exodrive.co/booking/test-token',
  referenceNumber: 'EXO-TEST123'
};

const mockPaymentData: PaymentReceiptData = {
  customerName: 'John Doe',
  customerEmail: 'john.doe@example.com',
  bookingId: '123e4567-e89b-12d3-a456-426614174000',
  transactionId: 'PAYPAL-TXN-123',
  carName: 'Lamborghini Huracán',
  paymentAmount: 2400,
  currency: 'USD',
  paymentMethod: 'PayPal',
  paymentDate: '2024-08-26T10:00:00Z',
  bookingUrl: 'https://exodrive.co/booking/test-token',
  invoiceNumber: 'INV-TEST123'
};

describe('Email Templates', () => {
  it('should generate booking confirmation HTML template', () => {
    const html = renderBookingConfirmationTemplate(mockBookingData);
    
    expect(html).toContain('Booking Confirmed!');
    expect(html).toContain(mockBookingData.customerName);
    expect(html).toContain(mockBookingData.carName);
    expect(html).toContain(mockBookingData.referenceNumber);
    expect(html).toContain('$2,400.00');
    expect(html).toContain('3 days');
    
    // Check for responsive design elements
    expect(html).toContain('@media only screen and (max-width: 600px)');
    
    // Check for proper HTML structure
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });
  
  it('should generate booking confirmation plain text template', () => {
    const text = renderBookingConfirmationPlainText(mockBookingData);
    
    expect(text).toContain('BOOKING CONFIRMED - EXODRIVE');
    expect(text).toContain(mockBookingData.customerName);
    expect(text).toContain(mockBookingData.carName);
    expect(text).toContain(mockBookingData.referenceNumber);
    expect(text).toContain('$2,400.00');
    expect(text).toContain('3 days');
    
    // Should not contain HTML tags
    expect(text).not.toContain('<html>');
    expect(text).not.toContain('<div>');
  });
  
  it('should generate payment receipt HTML template', () => {
    const html = renderPaymentReceiptTemplate(mockPaymentData);
    
    expect(html).toContain('Payment Received');
    expect(html).toContain(mockPaymentData.customerName);
    expect(html).toContain(mockPaymentData.transactionId);
    expect(html).toContain(mockPaymentData.invoiceNumber);
    expect(html).toContain('$2,400.00');
    expect(html).toContain('PayPal');
    
    // Check for success styling
    expect(html).toContain('#28a745'); // Green color
    expect(html).toContain('✓'); // Checkmark
  });
  
  it('should generate payment receipt plain text template', () => {
    const text = renderPaymentReceiptPlainText(mockPaymentData);
    
    expect(text).toContain('PAYMENT RECEIPT - EXODRIVE');
    expect(text).toContain(mockPaymentData.customerName);
    expect(text).toContain(mockPaymentData.transactionId);
    expect(text).toContain('$2,400.00');
    expect(text).toContain('PayPal');
    
    // Should not contain HTML tags
    expect(text).not.toContain('<html>');
    expect(text).not.toContain('<div>');
  });
  
  it('should handle missing optional data gracefully', () => {
    const minimalData: BookingConfirmationData = {
      ...mockBookingData,
      carImage: undefined,
      pickupLocation: undefined,
      dropoffLocation: undefined,
      deposit: undefined
    };
    
    const html = renderBookingConfirmationTemplate(minimalData);
    
    // Should still render without errors
    expect(html).toContain(minimalData.customerName);
    expect(html).toContain(minimalData.carName);
    
    // Should show default messages
    expect(html).toContain("We'll contact you to arrange pickup location");
    expect(html).toContain("Same as pickup location");
  });
});

describe('Email Service', () => {
  it('should have rate limiting functionality', () => {
    expect(typeof emailServiceResend.isRateLimited).toBe('function');
    
    // Test rate limiting
    const testIP = 'test-ip-' + Date.now();
    
    // First request should not be rate limited
    expect(emailServiceResend.isRateLimited(testIP)).toBe(false);
  });
  
  it('should have email sending methods', () => {
    expect(typeof emailServiceResend.sendBookingConfirmationEmail).toBe('function');
    expect(typeof emailServiceResend.sendPaymentReceiptEmail).toBe('function');
    expect(typeof emailServiceResend.sendBookingModificationEmail).toBe('function');
    expect(typeof emailServiceResend.sendBookingCancellationEmail).toBe('function');
  });
  
  it('should have retry functionality', () => {
    expect(typeof emailServiceResend.sendEmailWithRetry).toBe('function');
  });
  
  it('should format currency correctly', () => {
    const html = renderBookingConfirmationTemplate(mockBookingData);
    
    // Should format currency with commas and dollar sign
    expect(html).toContain('$2,400');
    
    // Test with different amounts
    const largeAmountData = {
      ...mockBookingData,
      totalPrice: 12345.67
    };
    
    const largeAmountHtml = renderBookingConfirmationTemplate(largeAmountData);
    expect(largeAmountHtml).toContain('$12,345.67');
  });
  
  it('should format dates correctly', () => {
    const html = renderBookingConfirmationTemplate(mockBookingData);
    
    // Should contain formatted dates
    expect(html).toContain('Sunday, September 15, 2024');
    expect(html).toContain('Wednesday, September 18, 2024');
  });
  
  it('should calculate days correctly', () => {
    const html = renderBookingConfirmationTemplate(mockBookingData);
    
    // Should show correct number of days
    expect(html).toContain('3 days');
    
    // Test single day booking
    const singleDayData = {
      ...mockBookingData,
      days: 1
    };
    
    const singleDayHtml = renderBookingConfirmationTemplate(singleDayData);
    expect(singleDayHtml).toContain('1 day');
    expect(singleDayHtml).not.toContain('1 days');
  });
});

describe('Email Template Accessibility', () => {
  it('should include alt text for images', () => {
    const html = renderBookingConfirmationTemplate(mockBookingData);
    
    if (mockBookingData.carImage) {
      expect(html).toContain(`alt="${mockBookingData.carName}"`);
    }
  });
  
  it('should have proper heading hierarchy', () => {
    const html = renderBookingConfirmationTemplate(mockBookingData);
    
    expect(html).toContain('<h1>');
    expect(html).toContain('<h2>');
    expect(html).toContain('<h3>');
  });
  
  it('should include plain text versions', () => {
    const text = renderBookingConfirmationPlainText(mockBookingData);
    const paymentText = renderPaymentReceiptPlainText(mockPaymentData);
    
    // Plain text should exist and contain key information
    expect(text.length).toBeGreaterThan(100);
    expect(paymentText.length).toBeGreaterThan(100);
    
    expect(text).toContain(mockBookingData.customerName);
    expect(paymentText).toContain(mockPaymentData.customerName);
  });
});

describe('Email Template Security', () => {
  it('should not execute JavaScript in email content', () => {
    const maliciousData = {
      ...mockBookingData,
      customerName: '<script>alert("xss")</script>John Doe'
    };
    
    const html = renderBookingConfirmationTemplate(maliciousData);
    
    // Should escape the script tag
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;'); // Escaped version
  });
  
  it('should handle special characters safely', () => {
    const specialCharData = {
      ...mockBookingData,
      customerName: 'John & Jane O\'Connor',
      carName: 'McLaren "Supercar" 720S'
    };
    
    const html = renderBookingConfirmationTemplate(specialCharData);
    const text = renderBookingConfirmationPlainText(specialCharData);
    
    // Should render without breaking
    expect(html).toContain('John &amp; Jane');
    expect(html).toContain('O&#x27;Connor');
    expect(html).toContain('&quot;Supercar&quot;');
    
    // Plain text should handle special characters
    expect(text).toContain("John & Jane O'Connor");
    expect(text).toContain('McLaren "Supercar" 720S');
  });
});

// Integration test with real booking data shape
describe('Email Integration', () => {
  it('should work with typical booking database structure', () => {
    // Simulate what would come from the database
    const dbBooking = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      },
      car: {
        name: 'Lamborghini Huracán',
        type: 'Supercar',
        images: [{ url: 'https://example.com/car.jpg' }]
      },
      start_date: '2024-09-15',
      end_date: '2024-09-18',
      total_price: 2400,
      currency: 'USD'
    };
    
    // Transform to email template format
    const emailData: BookingConfirmationData = {
      customerName: `${dbBooking.customer.first_name} ${dbBooking.customer.last_name}`.trim(),
      customerEmail: dbBooking.customer.email,
      bookingId: dbBooking.id,
      carName: dbBooking.car.name,
      carType: dbBooking.car.type,
      carImage: dbBooking.car.images[0]?.url,
      pickupDate: dbBooking.start_date,
      dropoffDate: dbBooking.end_date,
      totalPrice: dbBooking.total_price,
      currency: dbBooking.currency,
      days: 3, // Would be calculated
      basePrice: 800, // Would be calculated
      bookingUrl: `https://exodrive.co/booking/${dbBooking.id}`,
      referenceNumber: `EXO-${dbBooking.id.slice(0, 8).toUpperCase()}`
    };
    
    const html = renderBookingConfirmationTemplate(emailData);
    
    expect(html).toContain('John Doe');
    expect(html).toContain('Lamborghini Huracán');
    expect(html).toContain('EXO-123E4567');
  });
});