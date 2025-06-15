import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface BookingConfirmationData {
  customerEmail: string;
  customerName: string;
  bookingId: string;
  carName: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  currency: string;
  bookingUrl: string;
}

interface CancellationEmailData {
  customerEmail: string;
  customerName: string;
  bookingId: string;
  carName: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

/**
 * Send booking confirmation email to customer
 */
export async function sendBookingConfirmationEmail(data: BookingConfirmationData) {
  try {
    const { customerEmail, customerName, bookingId, carName, startDate, endDate, totalPrice, currency, bookingUrl } = data;

    const result = await resend.emails.send({
      from: 'exoDrive <bookings@exodrive.co>',
      to: customerEmail,
      subject: `Booking Confirmation - ${carName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #000; color: #fff; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .booking-details { background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .button { display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmation</h1>
            </div>
            <div class="content">
              <p>Dear ${customerName},</p>
              <p>Thank you for choosing exoDrive! Your booking has been successfully initiated.</p>
              
              <div class="booking-details">
                <h2>Booking Details</h2>
                <div class="detail-row">
                  <strong>Booking ID:</strong>
                  <span>${bookingId}</span>
                </div>
                <div class="detail-row">
                  <strong>Vehicle:</strong>
                  <span>${carName}</span>
                </div>
                <div class="detail-row">
                  <strong>Pickup Date:</strong>
                  <span>${new Date(startDate).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <strong>Return Date:</strong>
                  <span>${new Date(endDate).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <strong>Total Amount:</strong>
                  <span>${currency} ${totalPrice.toFixed(2)}</span>
                </div>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Complete your payment to secure this booking</li>
                <li>Sign the rental agreement when it's sent to you</li>
                <li>Bring your driver's license and payment method on pickup day</li>
              </ol>
              
              <div style="text-align: center;">
                <a href="${bookingUrl}" class="button">View Your Booking</a>
              </div>
              
              <p>If you have any questions, please don't hesitate to contact us.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} exoDrive. All rights reserved.</p>
              <p>This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Booking confirmation email sent successfully:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    return { success: false, error };
  }
}

/**
 * Send booking cancellation email to customer
 */
export async function sendBookingCancellationEmail(data: CancellationEmailData) {
  try {
    const { customerEmail, customerName, bookingId, carName, startDate, endDate, reason } = data;

    const result = await resend.emails.send({
      from: 'exoDrive <bookings@exodrive.co>',
      to: customerEmail,
      subject: `Booking Cancellation - ${carName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #d32f2f; color: #fff; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .booking-details { background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .footer { text-align: center; padding: 20px; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Cancellation</h1>
            </div>
            <div class="content">
              <p>Dear ${customerName},</p>
              <p>We regret to inform you that your booking has been cancelled.</p>
              
              <div class="booking-details">
                <h2>Cancelled Booking Details</h2>
                <div class="detail-row">
                  <strong>Booking ID:</strong>
                  <span>${bookingId}</span>
                </div>
                <div class="detail-row">
                  <strong>Vehicle:</strong>
                  <span>${carName}</span>
                </div>
                <div class="detail-row">
                  <strong>Pickup Date:</strong>
                  <span>${new Date(startDate).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <strong>Return Date:</strong>
                  <span>${new Date(endDate).toLocaleDateString()}</span>
                </div>
                ${reason ? `
                <div class="detail-row">
                  <strong>Reason:</strong>
                  <span>${reason}</span>
                </div>
                ` : ''}
              </div>
              
              <p>If you have already made a payment, you will receive a refund within 5-7 business days.</p>
              
              <p>We apologize for any inconvenience this may cause. If you have any questions or would like to make a new booking, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} exoDrive. All rights reserved.</p>
              <p>This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Booking cancellation email sent successfully:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending booking cancellation email:', error);
    return { success: false, error };
  }
}