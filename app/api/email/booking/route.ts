import { NextRequest, NextResponse } from "next/server"
import { emailServiceResend, type BookingConfirmationData } from "@/lib/services/email-service-resend"

export const runtime = "edge" // Use Edge Runtime

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BookingConfirmationData
    
    if (!body.customerName || !body.customerEmail || !body.carName || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "Missing required booking information" },
        { status: 400 }
      )
    }
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    const bookingTags = body.bookingId ? [{ name: 'booking_id', value: body.bookingId }] : undefined;
    
    const customerEmailContent = emailServiceResend.generateBookingConfirmationHtml(body)
    const customerPlainTextContent = emailServiceResend.generateBookingConfirmationPlainText(body)
    
    const customerResult = await emailServiceResend.sendEmail({
      to: body.customerEmail,
      subject: "Your ExoDrive Booking Confirmation",
      content: customerEmailContent,
      plainText: customerPlainTextContent,
      tags: bookingTags
    }, ipAddress.split(',')[0]) // Use first IP if multiple are provided
    
    if (!customerResult.success) {
      console.error("Error sending email to customer:", customerResult.error)
    }
    
    const businessEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Booking Notification</h2>
        <p>A new booking has been made on ExoDrive:</p>
        
        <h3 style="margin-top: 20px;">Booking Details:</h3>
        <p><strong>Customer:</strong> ${body.customerName} (${body.customerEmail})</p>
        ${body.customerPhone ? `<p><strong>Phone:</strong> ${body.customerPhone}</p>` : ''}
        <p><strong>Vehicle:</strong> ${body.carName}</p>
        <p><strong>Rental Period:</strong> ${body.startDate} to ${body.endDate} (${body.days} day${body.days !== 1 ? 's' : ''})</p>
        <p><strong>Daily Rate:</strong> $${body.basePrice.toLocaleString()}</p>
        <p><strong>Total:</strong> $${body.totalPrice.toLocaleString()}</p>
        <p><strong>Deposit (Due Now):</strong> $${body.deposit.toLocaleString()}</p>
      </div>
    `
    
    const businessPlainTextContent = `
NEW BOOKING NOTIFICATION

A new booking has been made on ExoDrive:

BOOKING DETAILS:
Customer: ${body.customerName} (${body.customerEmail})
${body.customerPhone ? `Phone: ${body.customerPhone}` : ''}
Vehicle: ${body.carName}
Rental Period: ${body.startDate} to ${body.endDate} (${body.days} day${body.days !== 1 ? 's' : ''})
Daily Rate: $${body.basePrice.toLocaleString()}
Total: $${body.totalPrice.toLocaleString()}
Deposit (Due Now): $${body.deposit.toLocaleString()}
    `.trim()
    
    const businessResult = await emailServiceResend.sendEmail({
      to: "exodrivexotics@gmail.com", // Business email
      subject: `New Booking: ${body.carName}`,
      content: businessEmailContent,
      plainText: businessPlainTextContent,
      replyTo: body.customerEmail, // Allow direct reply to customer
      tags: bookingTags
    }, ipAddress.split(',')[0]) // Use first IP if multiple are provided
    
    if (!customerResult.success && !businessResult.success) {
      return NextResponse.json(
        { error: "Failed to send emails" },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      customerEmailSent: customerResult.success,
      businessEmailSent: businessResult.success
    })
  } catch (error) {
    console.error("Error in booking email API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
