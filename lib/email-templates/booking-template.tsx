import React from 'react';
import { BookingConfirmationData } from '../services/email-service-resend';

export const BookingTemplate: React.FC<{ data: BookingConfirmationData }> = ({ data }) => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ color: '#333' }}>Your ExoDrive Booking Confirmation</h2>
      <p>Hello {data.customerName},</p>
      <p>Thank you for booking with ExoDrive! Your exotic car rental request has been received.</p>
      
      <h3 style={{ marginTop: '20px' }}>Booking Details:</h3>
      <p><strong>Vehicle:</strong> {data.carName}</p>
      <p><strong>Rental Period:</strong> {data.startDate} to {data.endDate} ({data.days} day{data.days !== 1 ? 's' : ''})</p>
      <p><strong>Daily Rate:</strong> ${data.basePrice.toLocaleString()}</p>
      <p><strong>Total:</strong> ${data.totalPrice.toLocaleString()}</p>
      <p><strong>Deposit (Due Now):</strong> ${data.deposit.toLocaleString()}</p>
      
      <p style={{ marginTop: '20px' }}>Our team will contact you shortly to finalize your reservation and arrange for payment.</p>
      
      <p style={{ marginTop: '30px' }}>Thank you for choosing ExoDrive!</p>
      <p>- The ExoDrive Team</p>
    </div>
  );
};

export const renderBookingTemplate = (data: BookingConfirmationData): string => {
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
};

export const renderBookingPlainText = (data: BookingConfirmationData): string => {
  return `
YOUR EXODRIVE BOOKING CONFIRMATION

Hello ${data.customerName},

Thank you for booking with ExoDrive! Your exotic car rental request has been received.

BOOKING DETAILS:
Vehicle: ${data.carName}
Rental Period: ${data.startDate} to ${data.endDate} (${data.days} day${data.days !== 1 ? 's' : ''})
Daily Rate: $${data.basePrice.toLocaleString()}
Total: $${data.totalPrice.toLocaleString()}
Deposit (Due Now): $${data.deposit.toLocaleString()}

Our team will contact you shortly to finalize your reservation and arrange for payment.

Thank you for choosing ExoDrive!
- The ExoDrive Team
  `.trim();
};
