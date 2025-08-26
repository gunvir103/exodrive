export interface PaymentReceiptData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  transactionId: string;
  carName: string;
  paymentAmount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  billingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  bookingUrl: string;
  invoiceNumber: string;
}

export const renderPaymentReceiptTemplate = (data: PaymentReceiptData): string => {
  const {
    customerName,
    bookingId,
    transactionId,
    carName,
    paymentAmount,
    currency,
    paymentMethod,
    paymentDate,
    billingAddress,
    bookingUrl,
    invoiceNumber
  } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
      <title>Payment Receipt - ExoDrive</title>
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
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
        
        .success-icon {
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
        
        .receipt-card {
          background-color: #f8f9fa;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          border: 1px solid #e9ecef;
        }
        
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #28a745;
        }
        
        .invoice-title {
          font-size: 24px;
          font-weight: 600;
          color: #333333;
        }
        
        .invoice-number {
          font-size: 14px;
          color: #666666;
        }
        
        .payment-details {
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
        
        .highlight-row {
          background-color: #e8f5e8;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
        
        .highlight-row .detail-label,
        .highlight-row .detail-value {
          padding: 0;
          font-size: 18px;
          font-weight: 700;
          color: #28a745;
        }
        
        .transaction-info {
          background-color: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        
        .transaction-info h4 {
          color: #333333;
          margin-bottom: 15px;
          font-size: 16px;
        }
        
        .billing-address {
          background-color: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        
        .billing-address h4 {
          color: #333333;
          margin-bottom: 15px;
          font-size: 16px;
        }
        
        .address-text {
          color: #555555;
          line-height: 1.6;
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
        
        .important-note {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 30px 0;
        }
        
        .important-note h4 {
          color: #856404;
          margin-bottom: 10px;
        }
        
        .important-note p {
          color: #856404;
          margin-bottom: 8px;
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
          
          .receipt-card {
            padding: 20px;
          }
          
          .invoice-header {
            flex-direction: column;
            text-align: center;
          }
          
          .invoice-title {
            font-size: 20px;
            margin-bottom: 10px;
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
          <div class="success-icon">✓</div>
          <h1>Payment Received</h1>
          <p class="subtitle">Your payment has been successfully processed</p>
        </div>
        
        <div class="content">
          <p class="greeting">Dear ${customerName},</p>
          
          <p class="intro-text">
            Thank you for your payment! We have successfully received and processed your payment for your ExoDrive booking. 
            This email serves as your official receipt for this transaction.
          </p>
          
          <div class="receipt-card">
            <div class="invoice-header">
              <div class="invoice-title">Payment Receipt</div>
              <div class="invoice-number">Invoice #${invoiceNumber}</div>
            </div>
            
            <div class="payment-details">
              <div class="detail-row">
                <div class="detail-label">Booking ID:</div>
                <div class="detail-value">${bookingId}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Vehicle:</div>
                <div class="detail-value">${carName}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Payment Date:</div>
                <div class="detail-value">${formatDate(paymentDate)}</div>
              </div>
              
              <div class="detail-row">
                <div class="detail-label">Payment Method:</div>
                <div class="detail-value">${paymentMethod}</div>
              </div>
            </div>
            
            <div class="highlight-row">
              <div class="detail-row">
                <div class="detail-label">Amount Paid:</div>
                <div class="detail-value">${formatCurrency(paymentAmount, currency)}</div>
              </div>
            </div>
            
            <div class="transaction-info">
              <h4>Transaction Information</h4>
              <div class="payment-details">
                <div class="detail-row">
                  <div class="detail-label">Transaction ID:</div>
                  <div class="detail-value">${transactionId}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Status:</div>
                  <div class="detail-value" style="color: #28a745; font-weight: 600;">Completed</div>
                </div>
              </div>
            </div>
            
            ${billingAddress ? `
            <div class="billing-address">
              <h4>Billing Address</h4>
              <div class="address-text">
                ${billingAddress.name}<br>
                ${billingAddress.address}<br>
                ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}<br>
                ${billingAddress.country}
              </div>
            </div>
            ` : ''}
          </div>
          
          <div class="important-note">
            <h4>Important Information</h4>
            <p>• Please keep this receipt for your records</p>
            <p>• This payment secures your booking reservation</p>
            <p>• You will receive a separate rental agreement to sign</p>
            <p>• Bring your driver's license and this receipt on pickup day</p>
          </div>
          
          <div class="cta-section">
            <a href="${bookingUrl}" class="cta-button">View Booking Details</a>
          </div>
          
          <p style="margin-top: 30px; color: #555555;">
            If you have any questions about this payment or your booking, please don't hesitate to contact our support team. 
            We're here to help make your exotic car rental experience exceptional.
          </p>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            &copy; ${new Date().getFullYear()} ExoDrive. All rights reserved.
          </p>
          <p class="footer-links">
            This is an automated receipt. Please save this email for your records.<br>
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

export const renderPaymentReceiptPlainText = (data: PaymentReceiptData): string => {
  const {
    customerName,
    bookingId,
    transactionId,
    carName,
    paymentAmount,
    currency,
    paymentMethod,
    paymentDate,
    billingAddress,
    bookingUrl,
    invoiceNumber
  } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  };

  return `
PAYMENT RECEIPT - EXODRIVE
Invoice #${invoiceNumber}

Dear ${customerName},

Thank you for your payment! We have successfully received and processed your payment for your ExoDrive booking. This email serves as your official receipt for this transaction.

PAYMENT DETAILS:
================
Booking ID: ${bookingId}
Vehicle: ${carName}
Payment Date: ${formatDate(paymentDate)}
Payment Method: ${paymentMethod}
AMOUNT PAID: ${formatCurrency(paymentAmount, currency)}

TRANSACTION INFORMATION:
========================
Transaction ID: ${transactionId}
Status: Completed

${billingAddress ? `
BILLING ADDRESS:
================
${billingAddress.name}
${billingAddress.address}
${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}
${billingAddress.country}
` : ''}

IMPORTANT INFORMATION:
======================
• Please keep this receipt for your records
• This payment secures your booking reservation
• You will receive a separate rental agreement to sign
• Bring your driver's license and this receipt on pickup day

View your booking details: ${bookingUrl}

If you have any questions about this payment or your booking, please don't hesitate to contact our support team. We're here to help make your exotic car rental experience exceptional.

© ${new Date().getFullYear()} ExoDrive. All rights reserved.
This is an automated receipt. Please save this email for your records.
  `.trim();
};