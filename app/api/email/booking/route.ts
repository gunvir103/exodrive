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
    
    const emailContent = emailServiceResend.generateBookingConfirmationHtml(body)
    
    const result = await emailServiceResend.sendEmail({
      to: body.customerEmail,
      subject: "Your ExoDrive Booking Confirmation",
      content: emailContent
    })
    
    if (!result.success) {
      throw new Error(result.error || "Failed to send email")
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in booking email API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
