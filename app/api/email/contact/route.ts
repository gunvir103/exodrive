import { NextRequest, NextResponse } from "next/server"
import { emailServiceResend, type ContactFormData } from "@/lib/services/email-service-resend"

export const runtime = "edge" // Use Edge Runtime

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ContactFormData
    
    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      )
    }
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    const businessEmailContent = emailServiceResend.generateContactEmailHtml(body)
    const businessPlainTextContent = emailServiceResend.generateContactEmailPlainText(body)
    
    const businessResult = await emailServiceResend.sendEmail({
      to: "exodrivexotics@gmail.com", // Business email
      subject: "New Contact Form Submission - ExoDrive",
      content: businessEmailContent,
      plainText: businessPlainTextContent,
      replyTo: body.email // Allow direct reply to customer
    }, ipAddress.split(',')[0]) // Use first IP if multiple are provided
    
    if (!businessResult.success) {
      console.error("Error sending email to business:", businessResult.error)
    }
    
    const customerEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Thank You for Contacting ExoDrive</h2>
        <p>Hello ${body.name},</p>
        <p>Thank you for reaching out to us. We have received your message and will get back to you as soon as possible.</p>
        
        <h3 style="margin-top: 20px;">Your Message:</h3>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">
          ${body.message.replace(/\n/g, '<br/>')}
        </div>
        
        <p style="margin-top: 20px;">If you have any additional questions, please don't hesitate to contact us.</p>
        
        <p style="margin-top: 30px;">Best regards,</p>
        <p>The ExoDrive Team</p>
      </div>
    `
    
    const customerPlainTextContent = `
THANK YOU FOR CONTACTING EXODRIVE

Hello ${body.name},

Thank you for reaching out to us. We have received your message and will get back to you as soon as possible.

YOUR MESSAGE:
${body.message}

If you have any additional questions, please don't hesitate to contact us.

Best regards,
The ExoDrive Team
    `.trim()
    
    // Send confirmation email to customer
    const customerResult = await emailServiceResend.sendEmail({
      to: body.email, // Customer's email
      subject: "Thank You for Contacting ExoDrive",
      content: customerEmailContent,
      plainText: customerPlainTextContent
    }, ipAddress.split(',')[0]) // Use first IP if multiple are provided
    
    if (!businessResult.success && !customerResult.success) {
      return NextResponse.json(
        { error: "Failed to send emails" },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      businessEmailSent: businessResult.success,
      customerEmailSent: customerResult.success
    })
  } catch (error) {
    console.error("Error in contact email API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
