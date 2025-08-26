export interface BookingCancellationData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  carName: string;
  carType: string;
  pickupDate: string;
  dropoffDate: string;
  totalPrice: number;
  currency: string;
  cancellationDate: string;
  cancellationReason?: string;
  refundAmount: number;
  refundProcessingDays: number;
  cancellationFee?: number;
  refundMethod: string;
  isCustomerCancelled: boolean;
  referenceNumber: string;
}

export const renderBookingCancellationTemplate = (data: BookingCancellationData): string => {
  const {
    customerName,
    bookingId,
    carName,
    carType,
    pickupDate,
    dropoffDate,
    totalPrice,
    currency,
    cancellationDate,
    cancellationReason,
    refundAmount,
    refundProcessingDays,
    cancellationFee,
    refundMethod,
    isCustomerCancelled,
    referenceNumber
  } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Cancellation - ExoDrive</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          background-color: #f5f5f5;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          color: #ffffff;
          padding: 40px 30px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .header .subtitle {
          font-size: 16px;
          opacity: 0.9;
        }
        
        .cancellation-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 20px;
          background-color: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
          color: #333333;
        }
        
        .intro-text {
          font-size: 16px;
          margin-bottom: 30px;
          color: #555555;
          line-height: 1.6;
        }
        
        .cancellation-card {
          background-color: #f8f9fa;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          border: 1px solid #e9ecef;
        }
        
        .reference-number {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 6px;
          padding: 15px;
          margin: 25px 0;
          text-align: center;
        }
        
        .reference-number .label {
          font-size: 14px;
          color: #721c24;
          margin-bottom: 5px;
        }
        
        .reference-number .number {
          font-size: 20px;
          font-weight: 700;
          color: #dc3545;
          letter-spacing: 1px;
        }
        
        .booking-details {
          display: table;
          width: 100%;
          margin-bottom: 30px;
        }
        
        .detail-row {
          display: table-row;
        }
        
        .detail-label,
        .detail-value {
          display: table-cell;
          padding: 12px 0;
          vertical-align: top;
        }
        
        .detail-label {
          font-weight: 600;
          color: #333333;
          width: 40%;
        }
        
        .detail-value {
          color: #555555;
          text-align: right;
        }
        
        .cancelled-item {
          text-decoration: line-through;
          color: #999999;
        }
        
        .cancellation-info {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .cancellation-info h4 {
          color: #856404;
          margin-bottom: 15px;
          font-size: 16px;
        }
        
        .cancellation-info .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .cancellation-info .info-label {
          color: #856404;
          font-weight: 600;
        }
        
        .cancellation-info .info-value {
          color: #856404;
        }
        
        .refund-section {
          background-color: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 8px;
          padding: 25px;
          margin: 25px 0;
        }
        
        .refund-section h3 {
          color: #155724;
          margin-bottom: 20px;
          font-size: 18px;
        }
        
        .refund-breakdown {
          background-color: #ffffff;
          border-radius: 6px;
          padding: 20px;
          margin: 15px 0;
        }
        
        .refund-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }
        
        .refund-row:last-child {
          border-bottom: none;
          font-weight: 600;
          font-size: 18px;
          color: #155724;
          padding-top: 15px;
          border-top: 2px solid #155724;
        }
        
        .refund-label {
          color: #333333;
        }
        
        .refund-value {
          color: #555555;
        }
        
        .refund-processing {
          background-color: rgba(21, 87, 36, 0.1);
          border-radius: 6px;
          padding: 15px;
          margin-top: 15px;
          text-align: center;
        }
        
        .refund-processing .processing-text {
          color: #155724;
          font-size: 14px;
        }
        
        ${cancellationReason ? `
        .reason-section {
          background-color: #e2e3e5;
          border: 1px solid #d1d3d4;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .reason-section h4 {
          color: #333333;
          margin-bottom: 10px;
        }
        
        .reason-text {
          color: #555555;
        }
        ` : ''}
        
        .next-steps {
          background-color: #f0f8ff;
          border-left: 4px solid #0066cc;
          padding: 25px;
          margin: 30px 0;
        }
        
        .next-steps h3 {
          color: #333333;
          margin-bottom: 15px;
          font-size: 18px;
        }
        
        .steps-list {
          list-style: none;
          counter-reset: step-counter;
        }
        
        .steps-list li {
          counter-increment: step-counter;
          margin-bottom: 12px;
          position: relative;
          padding-left: 40px;
        }
        
        .steps-list li::before {
          content: counter(step-counter);
          position: absolute;
          left: 0;
          top: 0;
          background-color: #0066cc;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        
        .contact-info {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin: 30px 0;
          text-align: center;
        }
        
        .contact-info h4 {
          color: #333333;
          margin-bottom: 10px;
        }
        
        .contact-info p {
          color: #555555;
          margin-bottom: 5px;
        }
        
        .footer {
          background-color: #f8f9fa;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        
        .footer-text {
          font-size: 14px;
          color: #666666;
          margin-bottom: 10px;
        }
        
        .footer-links {
          font-size: 12px;
          color: #888888;
        }
        
        .footer-links a {
          color: #0066cc;
          text-decoration: none;
        }
        
        @media only screen and (max-width: 600px) {
          .email-container {
            margin: 0;
            box-shadow: none;
          }
          
          .header,
          .content {
            padding: 30px 20px;
          }
          
          .cancellation-card {
            padding: 20px;
          }
          
          .detail-label,
          .detail-value {
            display: block;
            width: 100%;
            text-align: left;
          }
          
          .detail-value {
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e9ecef;
          }
          
          .refund-row,
          .cancellation-info .info-row {
            flex-direction: column;
            text-align: left;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="cancellation-icon">✕</div>
          <h1>Booking Cancelled</h1>
          <p class="subtitle">Your reservation has been cancelled</p>
        </div>
        
        <div class="content">
          <p class="greeting">Dear ${customerName},</p>
          
          <p class="intro-text">
            ${isCustomerCancelled 
              ? 'We have received and processed your cancellation request for your ExoDrive booking. We\'re sorry to see you won\'t be joining us for this experience.' 
              : 'We regret to inform you that your ExoDrive booking has been cancelled. We sincerely apologize for any inconvenience this may cause.'
            }
          </p>
          
          <div class="reference-number">
            <div class="label">Cancellation Reference</div>
            <div class="number">${referenceNumber}</div>
          </div>
          
          <div class="cancellation-card">
            <h2 style="color: #333333; margin-bottom: 20px; font-size: 20px;">Cancelled Booking Details</h2>
            
            <div class="booking-details">
              <div class="detail-row">
                <div class="detail-label">Booking ID:</div>
                <div class="detail-value cancelled-item">${bookingId}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Vehicle:</div>
                <div class="detail-value cancelled-item">${carName}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Type:</div>
                <div class="detail-value cancelled-item">${carType}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Pickup Date:</div>
                <div class="detail-value cancelled-item">${formatDate(pickupDate)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Return Date:</div>
                <div class="detail-value cancelled-item">${formatDate(dropoffDate)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Original Total:</div>
                <div class="detail-value cancelled-item">${formatCurrency(totalPrice, currency)}</div>
              </div>
            </div>
            
            <div class="cancellation-info">
              <h4>Cancellation Information</h4>
              <div class="info-row">
                <div class="info-label">Cancelled On:</div>
                <div class="info-value">${formatDate(cancellationDate)}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Cancelled By:</div>
                <div class="info-value">${isCustomerCancelled ? 'Customer' : 'ExoDrive'}</div>
              </div>
            </div>
            
            ${cancellationReason ? `
            <div class="reason-section">
              <h4>Reason for Cancellation</h4>
              <p class="reason-text">${cancellationReason}</p>
            </div>
            ` : ''}
            
            ${refundAmount > 0 ? `
            <div class="refund-section">
              <h3>Refund Information</h3>
              <div class="refund-breakdown">
                <div class="refund-row">
                  <div class="refund-label">Original Payment:</div>
                  <div class="refund-value">${formatCurrency(totalPrice, currency)}</div>
                </div>
                
                ${cancellationFee ? `
                <div class="refund-row">
                  <div class="refund-label">Cancellation Fee:</div>
                  <div class="refund-value">-${formatCurrency(cancellationFee, currency)}</div>
                </div>
                ` : ''}
                
                <div class="refund-row">
                  <div class="refund-label">Refund Amount:</div>
                  <div class="refund-value">${formatCurrency(refundAmount, currency)}</div>
                </div>
              </div>
              
              <div class="refund-processing">
                <p class="processing-text">
                  <strong>Refund Method:</strong> ${refundMethod}<br>
                  <strong>Processing Time:</strong> ${refundProcessingDays} business days<br>
                  The refund will be credited to your original payment method.
                </p>
              </div>
            </div>
            ` : ''}
          </div>
          
          <div class="next-steps">
            <h3>What happens next?</h3>
            <ol class="steps-list">
              ${refundAmount > 0 ? '<li>Your refund will be processed automatically</li>' : ''}
              <li>You will receive a refund confirmation email once processed</li>
              <li>The refund will appear in your account within ${refundProcessingDays} business days</li>
              <li>This booking is now completely cancelled and removed from our system</li>
              ${!isCustomerCancelled ? '<li>Our team will contact you to discuss alternative options if desired</li>' : ''}
            </ol>
          </div>
          
          <p style="margin: 30px 0; color: #555555;">
            ${isCustomerCancelled 
              ? 'We understand that plans can change. We hope to have the opportunity to serve you in the future and provide you with an exceptional exotic car experience.'
              : 'We deeply apologize for this cancellation and any inconvenience it may cause. Our team is working to resolve the issue that led to this cancellation.'
            }
          </p>
          
          <div class="contact-info">
            <h4>Questions about your cancellation?</h4>
            <p>Our support team is here to help with any questions or concerns.</p>
            <p><strong>Email:</strong> support@exodrive.co</p>
            <p><strong>Phone:</strong> (555) 123-EXOD</p>
            <p><strong>Hours:</strong> Monday - Sunday, 9 AM - 8 PM EST</p>
          </div>
          
          ${isCustomerCancelled ? `
          <div style="background-color: #e8f4f8; border: 1px solid #b8e6f0; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
            <h4 style="color: #0066cc; margin-bottom: 10px;">Ready to book again?</h4>
            <p style="color: #555555; margin-bottom: 15px;">Explore our collection of exotic cars and plan your next adventure.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/cars" style="display: inline-block; background-color: #0066cc; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Browse Available Cars</a>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p class="footer-text">
            &copy; ${new Date().getFullYear()} ExoDrive. All rights reserved.
          </p>
          <p class="footer-links">
            This is an automated cancellation notification.<br>
            <a href="mailto:support@exodrive.co">Contact Support</a> | 
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/privacy">Privacy Policy</a> | 
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/terms">Terms of Service</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const renderBookingCancellationPlainText = (data: BookingCancellationData): string => {
  const {
    customerName,
    bookingId,
    carName,
    carType,
    pickupDate,
    dropoffDate,
    totalPrice,
    currency,
    cancellationDate,
    cancellationReason,
    refundAmount,
    refundProcessingDays,
    cancellationFee,
    refundMethod,
    isCustomerCancelled,
    referenceNumber
  } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  };

  return `
BOOKING CANCELLED - EXODRIVE
Cancellation Reference: ${referenceNumber}

Dear ${customerName},

${isCustomerCancelled 
  ? 'We have received and processed your cancellation request for your ExoDrive booking. We\'re sorry to see you won\'t be joining us for this experience.' 
  : 'We regret to inform you that your ExoDrive booking has been cancelled. We sincerely apologize for any inconvenience this may cause.'
}

CANCELLED BOOKING DETAILS:
===========================
Booking ID: ${bookingId} [CANCELLED]
Vehicle: ${carName} (${carType}) [CANCELLED]
Pickup Date: ${formatDate(pickupDate)} [CANCELLED]
Return Date: ${formatDate(dropoffDate)} [CANCELLED]
Original Total: ${formatCurrency(totalPrice, currency)} [CANCELLED]

CANCELLATION INFORMATION:
=========================
Cancelled On: ${formatDate(cancellationDate)}
Cancelled By: ${isCustomerCancelled ? 'Customer' : 'ExoDrive'}

${cancellationReason ? `
REASON FOR CANCELLATION:
========================
${cancellationReason}
` : ''}

${refundAmount > 0 ? `
REFUND INFORMATION:
===================
Original Payment: ${formatCurrency(totalPrice, currency)}
${cancellationFee ? `Cancellation Fee: -${formatCurrency(cancellationFee, currency)}` : ''}
Refund Amount: ${formatCurrency(refundAmount, currency)}
Refund Method: ${refundMethod}
Processing Time: ${refundProcessingDays} business days

The refund will be credited to your original payment method.
` : ''}

WHAT HAPPENS NEXT:
==================
${refundAmount > 0 ? '• Your refund will be processed automatically' : ''}
• You will receive a refund confirmation email once processed
• The refund will appear in your account within ${refundProcessingDays} business days
• This booking is now completely cancelled and removed from our system
${!isCustomerCancelled ? '• Our team will contact you to discuss alternative options if desired' : ''}

${isCustomerCancelled 
  ? 'We understand that plans can change. We hope to have the opportunity to serve you in the future and provide you with an exceptional exotic car experience.'
  : 'We deeply apologize for this cancellation and any inconvenience it may cause. Our team is working to resolve the issue that led to this cancellation.'
}

QUESTIONS ABOUT YOUR CANCELLATION?
===================================
Our support team is here to help with any questions or concerns.
Email: support@exodrive.co
Phone: (555) 123-EXOD
Hours: Monday - Sunday, 9 AM - 8 PM EST

${isCustomerCancelled ? `
Ready to book again? Explore our collection of exotic cars and plan your next adventure.
Browse Available Cars: ${process.env.NEXT_PUBLIC_BASE_URL}/cars
` : ''}

© ${new Date().getFullYear()} ExoDrive. All rights reserved.
This is an automated cancellation notification.
  `.trim();
};