export interface BookingConfirmationData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  carName: string;
  carImage?: string;
  carType: string;
  pickupDate: string;
  dropoffDate: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  totalPrice: number;
  currency: string;
  basePrice: number;
  days: number;
  deposit?: number;
  bookingUrl: string;
  referenceNumber: string;
}

export const renderBookingConfirmationTemplate = (data: BookingConfirmationData): string => {
  const {
    customerName,
    bookingId,
    carName,
    carImage,
    carType,
    pickupDate,
    dropoffDate,
    pickupLocation = "We'll contact you to arrange pickup location",
    dropoffLocation = "Same as pickup location",
    totalPrice,
    currency,
    basePrice,
    days,
    deposit,
    bookingUrl,
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
      <title>Booking Confirmation - ExoDrive</title>
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
          background: linear-gradient(135deg, #000000 0%, #333333 100%);
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
        
        .booking-card {
          background-color: #f8f9fa;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          border: 1px solid #e9ecef;
        }
        
        .car-section {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 25px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .car-image {
          width: 100%;
          max-width: 300px;
          height: 180px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 15px;
        }
        
        .car-name {
          font-size: 24px;
          font-weight: 600;
          color: #333333;
          margin-bottom: 8px;
        }
        
        .car-type {
          font-size: 14px;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .booking-details {
          display: table;
          width: 100%;
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
        
        .highlight-value {
          font-weight: 600;
          color: #000000;
          font-size: 18px;
        }
        
        .reference-number {
          background-color: #e8f4f8;
          border: 1px solid #b8e6f0;
          border-radius: 6px;
          padding: 15px;
          margin: 25px 0;
          text-align: center;
        }
        
        .reference-number .label {
          font-size: 14px;
          color: #666666;
          margin-bottom: 5px;
        }
        
        .reference-number .number {
          font-size: 20px;
          font-weight: 700;
          color: #0066cc;
          letter-spacing: 1px;
        }
        
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
          
          .booking-card {
            padding: 20px;
          }
          
          .car-name {
            font-size: 20px;
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
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>Booking Confirmed!</h1>
          <p class="subtitle">Your exotic car rental is being processed</p>
        </div>
        
        <div class="content">
          <p class="greeting">Hello ${customerName},</p>
          
          <p class="intro-text">
            Thank you for choosing ExoDrive! We're excited to confirm your exotic car rental reservation. 
            Your booking has been successfully received and is now being processed by our team.
          </p>
          
          <div class="reference-number">
            <div class="label">Your Reference Number</div>
            <div class="number">${referenceNumber}</div>
          </div>
          
          <div class="booking-card">
            <div class="car-section">
              ${carImage ? `<img src="${carImage}" alt="${carName}" class="car-image" />` : ''}
              <h2 class="car-name">${carName}</h2>
              <p class="car-type">${carType}</p>
            </div>
            
            <div class="booking-details">
              <div class="detail-row">
                <div class="detail-label">Booking ID:</div>
                <div class="detail-value">${bookingId}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Pickup Date:</div>
                <div class="detail-value">${formatDate(pickupDate)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Return Date:</div>
                <div class="detail-value">${formatDate(dropoffDate)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Rental Period:</div>
                <div class="detail-value">${days} ${days === 1 ? 'day' : 'days'}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Pickup Location:</div>
                <div class="detail-value">${pickupLocation}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Return Location:</div>
                <div class="detail-value">${dropoffLocation}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Daily Rate:</div>
                <div class="detail-value">${formatCurrency(basePrice, currency)}</div>
              </div>
              
              ${deposit ? `
              <div class="detail-row">
                <div class="detail-label">Security Deposit:</div>
                <div class="detail-value">${formatCurrency(deposit, currency)}</div>
              </div>
              ` : ''}
              
              <div class="detail-row">
                <div class="detail-label">Total Amount:</div>
                <div class="detail-value highlight-value">${formatCurrency(totalPrice, currency)}</div>
              </div>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>What happens next?</h3>
            <ol class="steps-list">
              <li>We'll verify your booking details and car availability</li>
              <li>Complete your payment to secure the reservation</li>
              <li>Receive and sign the rental agreement</li>
              <li>Present your driver's license and credit card at pickup</li>
              <li>Enjoy your exotic car experience!</li>
            </ol>
          </div>
          
          <div class="cta-section">
            <a href="${bookingUrl}" class="cta-button">View Booking Details</a>
          </div>
          
          <div class="contact-info">
            <h4>Need Help?</h4>
            <p>Our team is here to assist you with any questions.</p>
            <p><strong>Email:</strong> support@exodrive.co</p>
            <p><strong>Phone:</strong> (555) 123-EXOD</p>
            <p><strong>Hours:</strong> Monday - Sunday, 9 AM - 8 PM EST</p>
          </div>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            &copy; ${new Date().getFullYear()} ExoDrive. All rights reserved.
          </p>
          <p class="footer-links">
            This is an automated message. Please do not reply directly to this email.<br>
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

export const renderBookingConfirmationPlainText = (data: BookingConfirmationData): string => {
  const {
    customerName,
    bookingId,
    carName,
    carType,
    pickupDate,
    dropoffDate,
    pickupLocation = "We'll contact you to arrange pickup location",
    dropoffLocation = "Same as pickup location",
    totalPrice,
    currency,
    basePrice,
    days,
    deposit,
    bookingUrl,
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
BOOKING CONFIRMED - EXODRIVE

Hello ${customerName},

Thank you for choosing ExoDrive! We're excited to confirm your exotic car rental reservation. Your booking has been successfully received and is now being processed by our team.

YOUR REFERENCE NUMBER: ${referenceNumber}

BOOKING DETAILS:
================
Booking ID: ${bookingId}
Vehicle: ${carName} (${carType})
Pickup Date: ${formatDate(pickupDate)}
Return Date: ${formatDate(dropoffDate)}
Rental Period: ${days} ${days === 1 ? 'day' : 'days'}
Pickup Location: ${pickupLocation}
Return Location: ${dropoffLocation}
Daily Rate: ${formatCurrency(basePrice, currency)}
${deposit ? `Security Deposit: ${formatCurrency(deposit, currency)}` : ''}
TOTAL AMOUNT: ${formatCurrency(totalPrice, currency)}

WHAT HAPPENS NEXT:
==================
1. We'll verify your booking details and car availability
2. Complete your payment to secure the reservation
3. Receive and sign the rental agreement
4. Present your driver's license and credit card at pickup
5. Enjoy your exotic car experience!

View your booking details: ${bookingUrl}

NEED HELP?
==========
Our team is here to assist you with any questions.
Email: support@exodrive.co
Phone: (555) 123-EXOD
Hours: Monday - Sunday, 9 AM - 8 PM EST

© ${new Date().getFullYear()} ExoDrive. All rights reserved.
This is an automated message. Please do not reply directly to this email.
  `.trim();
};