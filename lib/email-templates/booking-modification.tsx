export interface BookingModificationData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  carName: string;
  modificationType: 'dates' | 'vehicle' | 'details' | 'cancellation';
  changes: {
    field: string;
    previousValue: string;
    newValue: string;
  }[];
  newTotalPrice?: number;
  previousTotalPrice?: number;
  currency: string;
  effectiveDate: string;
  bookingUrl: string;
  reason?: string;
  additionalFees?: number;
}

export const renderBookingModificationTemplate = (data: BookingModificationData): string => {
  const {
    customerName,
    bookingId,
    carName,
    modificationType,
    changes,
    newTotalPrice,
    previousTotalPrice,
    currency,
    effectiveDate,
    bookingUrl,
    reason,
    additionalFees
  } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
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

  const getModificationTitle = (type: string) => {
    switch (type) {
      case 'dates': return 'Booking Dates Modified';
      case 'vehicle': return 'Vehicle Changed';
      case 'details': return 'Booking Details Updated';
      case 'cancellation': return 'Booking Cancelled';
      default: return 'Booking Modified';
    }
  };

  const getModificationIcon = (type: string) => {
    switch (type) {
      case 'dates': return '📅';
      case 'vehicle': return '🚗';
      case 'details': return '📝';
      case 'cancellation': return '❌';
      default: return '✏️';
    }
  };

  const getHeaderColor = (type: string) => {
    switch (type) {
      case 'cancellation': return 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
      case 'vehicle': return 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)';
      default: return 'linear-gradient(135deg, #fd7e14 0%, #e8590c 100%)';
    }
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${getModificationTitle(modificationType)} - ExoDrive</title>
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
          background: ${getHeaderColor(modificationType)};
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
        
        .modification-icon {
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
        
        .modification-card {
          background-color: #f8f9fa;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          border: 1px solid #e9ecef;
        }
        
        .booking-info {
          background-color: #e8f4f8;
          border: 1px solid #b8e6f0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }
        
        .booking-info h3 {
          color: #0066cc;
          margin-bottom: 10px;
          font-size: 18px;
        }
        
        .booking-info p {
          color: #555555;
          margin-bottom: 5px;
        }
        
        .changes-section {
          margin: 25px 0;
        }
        
        .changes-section h3 {
          color: #333333;
          margin-bottom: 20px;
          font-size: 18px;
        }
        
        .change-item {
          background-color: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
        }
        
        .change-field {
          font-weight: 600;
          color: #333333;
          margin-bottom: 10px;
        }
        
        .change-comparison {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 15px;
          align-items: center;
        }
        
        .previous-value {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          padding: 12px;
          border-radius: 6px;
          color: #721c24;
          text-decoration: line-through;
        }
        
        .arrow {
          color: #fd7e14;
          font-size: 20px;
          font-weight: bold;
        }
        
        .new-value {
          background-color: #d4edda;
          border: 1px solid #c3e6cb;
          padding: 12px;
          border-radius: 6px;
          color: #155724;
          font-weight: 600;
        }
        
        .price-section {
          background-color: #ffffff;
          border: 2px solid #fd7e14;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .price-comparison {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .price-item {
          text-align: center;
        }
        
        .price-label {
          font-size: 14px;
          color: #666666;
          margin-bottom: 5px;
        }
        
        .price-amount {
          font-size: 18px;
          font-weight: 600;
          color: #333333;
        }
        
        .price-difference {
          text-align: center;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
        }
        
        .price-difference .label {
          font-size: 14px;
          color: #666666;
          margin-bottom: 5px;
        }
        
        .price-difference .amount {
          font-size: 20px;
          font-weight: 700;
        }
        
        .price-increase {
          color: #dc3545;
        }
        
        .price-decrease {
          color: #28a745;
        }
        
        .effective-date {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 15px;
          margin: 25px 0;
          text-align: center;
        }
        
        .effective-date .label {
          font-size: 14px;
          color: #856404;
          margin-bottom: 5px;
        }
        
        .effective-date .date {
          font-size: 16px;
          font-weight: 600;
          color: #856404;
        }
        
        ${reason ? `
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
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
          color: #ffffff !important;
          padding: 16px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          text-align: center;
          margin: 30px 0;
          transition: transform 0.2s ease;
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
        }
        
        .cta-section {
          text-align: center;
          margin: 40px 0;
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
          
          .modification-card {
            padding: 20px;
          }
          
          .change-comparison {
            grid-template-columns: 1fr;
            gap: 10px;
            text-align: center;
          }
          
          .arrow {
            transform: rotate(90deg);
          }
          
          .price-comparison {
            flex-direction: column;
            gap: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="modification-icon">${getModificationIcon(modificationType)}</div>
          <h1>${getModificationTitle(modificationType)}</h1>
          <p class="subtitle">Your booking has been updated</p>
        </div>
        
        <div class="content">
          <p class="greeting">Hello ${customerName},</p>
          
          <p class="intro-text">
            We're writing to confirm that your ExoDrive booking has been ${modificationType === 'cancellation' ? 'cancelled' : 'modified'} as requested. 
            Please review the changes below and contact us if you have any questions.
          </p>
          
          <div class="booking-info">
            <h3>Booking Information</h3>
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Vehicle:</strong> ${carName}</p>
          </div>
          
          <div class="modification-card">
            <div class="changes-section">
              <h3>Changes Made</h3>
              ${changes.map(change => `
                <div class="change-item">
                  <div class="change-field">${change.field}</div>
                  <div class="change-comparison">
                    <div class="previous-value">${change.previousValue}</div>
                    <div class="arrow">→</div>
                    <div class="new-value">${change.newValue}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            
            ${newTotalPrice !== undefined && previousTotalPrice !== undefined ? `
            <div class="price-section">
              <div class="price-comparison">
                <div class="price-item">
                  <div class="price-label">Previous Total</div>
                  <div class="price-amount">${formatCurrency(previousTotalPrice, currency)}</div>
                </div>
                <div class="price-item">
                  <div class="price-label">New Total</div>
                  <div class="price-amount">${formatCurrency(newTotalPrice, currency)}</div>
                </div>
              </div>
              
              <div class="price-difference">
                <div class="label">Price Difference</div>
                <div class="amount ${newTotalPrice > previousTotalPrice ? 'price-increase' : 'price-decrease'}">
                  ${newTotalPrice > previousTotalPrice ? '+' : ''}${formatCurrency(newTotalPrice - previousTotalPrice, currency)}
                </div>
              </div>
              
              ${additionalFees ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                <div class="price-label">Modification Fee</div>
                <div class="price-amount" style="color: #dc3545;">${formatCurrency(additionalFees, currency)}</div>
              </div>
              ` : ''}
            </div>
            ` : ''}
            
            <div class="effective-date">
              <div class="label">Effective Date</div>
              <div class="date">${formatDate(effectiveDate)}</div>
            </div>
            
            ${reason ? `
            <div class="reason-section">
              <h4>Reason for Change</h4>
              <p class="reason-text">${reason}</p>
            </div>
            ` : ''}
          </div>
          
          ${modificationType !== 'cancellation' ? `
          <div class="cta-section">
            <a href="${bookingUrl}" class="cta-button">View Updated Booking</a>
          </div>
          ` : ''}
          
          <p style="margin-top: 30px; color: #555555;">
            ${modificationType === 'cancellation' 
              ? 'If you made any payments, refunds will be processed according to our cancellation policy. You should see the refund in your account within 5-7 business days.'
              : 'If you need to make additional changes or have any questions about these modifications, please contact our support team immediately.'
            }
          </p>
          
          <div style="background-color: #f0f8ff; border-left: 4px solid #0066cc; padding: 20px; margin: 30px 0;">
            <h4 style="color: #333333; margin-bottom: 10px;">Need Help?</h4>
            <p style="color: #555555; margin-bottom: 5px;"><strong>Email:</strong> support@exodrive.co</p>
            <p style="color: #555555; margin-bottom: 5px;"><strong>Phone:</strong> (555) 123-EXOD</p>
            <p style="color: #555555;"><strong>Hours:</strong> Monday - Sunday, 9 AM - 8 PM EST</p>
          </div>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            &copy; ${new Date().getFullYear()} ExoDrive. All rights reserved.
          </p>
          <p class="footer-links">
            This is an automated notification. Please contact support for assistance.<br>
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

export const renderBookingModificationPlainText = (data: BookingModificationData): string => {
  const {
    customerName,
    bookingId,
    carName,
    modificationType,
    changes,
    newTotalPrice,
    previousTotalPrice,
    currency,
    effectiveDate,
    bookingUrl,
    reason,
    additionalFees
  } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
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

  const getModificationTitle = (type: string) => {
    switch (type) {
      case 'dates': return 'BOOKING DATES MODIFIED';
      case 'vehicle': return 'VEHICLE CHANGED';
      case 'details': return 'BOOKING DETAILS UPDATED';
      case 'cancellation': return 'BOOKING CANCELLED';
      default: return 'BOOKING MODIFIED';
    }
  };

  return `
${getModificationTitle(modificationType)} - EXODRIVE

Hello ${customerName},

We're writing to confirm that your ExoDrive booking has been ${modificationType === 'cancellation' ? 'cancelled' : 'modified'} as requested. Please review the changes below and contact us if you have any questions.

BOOKING INFORMATION:
====================
Booking ID: ${bookingId}
Vehicle: ${carName}

CHANGES MADE:
=============
${changes.map(change => `
${change.field}:
Previous: ${change.previousValue}
New: ${change.newValue}
`).join('\n')}

${newTotalPrice !== undefined && previousTotalPrice !== undefined ? `
PRICE CHANGES:
==============
Previous Total: ${formatCurrency(previousTotalPrice, currency)}
New Total: ${formatCurrency(newTotalPrice, currency)}
Price Difference: ${newTotalPrice > previousTotalPrice ? '+' : ''}${formatCurrency(newTotalPrice - previousTotalPrice, currency)}
${additionalFees ? `Modification Fee: ${formatCurrency(additionalFees, currency)}` : ''}
` : ''}

EFFECTIVE DATE: ${formatDate(effectiveDate)}

${reason ? `
REASON FOR CHANGE:
==================
${reason}
` : ''}

${modificationType !== 'cancellation' ? `View Updated Booking: ${bookingUrl}` : ''}

${modificationType === 'cancellation' 
  ? 'If you made any payments, refunds will be processed according to our cancellation policy. You should see the refund in your account within 5-7 business days.'
  : 'If you need to make additional changes or have any questions about these modifications, please contact our support team immediately.'
}

NEED HELP?
==========
Email: support@exodrive.co
Phone: (555) 123-EXOD
Hours: Monday - Sunday, 9 AM - 8 PM EST

© ${new Date().getFullYear()} ExoDrive. All rights reserved.
This is an automated notification. Please contact support for assistance.
  `.trim();
};