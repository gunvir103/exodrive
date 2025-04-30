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
    
    const emailContent = emailServiceResend.generateContactEmailHtml(body)
    
    const result = await emailServiceResend.sendEmail({
      to: "exodrivexotics@gmail.com", // Business email from the contact page
      subject: "New Contact Form Submission - ExoDrive",
      content: emailContent,
      replyTo: body.email // Allow direct reply to customer
    })
    
    if (!result.success) {
      throw new Error(result.error || "Failed to send email")
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in contact email API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
