import { NextRequest, NextResponse } from "next/server";
import { createBooking, CreateBookingPayload } from "@/lib/queries/bookings";
import { carServiceSupabase } from "@/lib/services/car-service-supabase";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { differenceInDays, format } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateBookingPayload;

    // Validate payload essentials (basic check, more comprehensive validation can be added)
    if (
      !payload.carId ||
      !payload.startDate ||
      !payload.endDate ||
      !payload.firstName ||
      !payload.lastName ||
      !payload.email ||
      !payload.totalPrice
    ) {
      return NextResponse.json(
        { error: "Missing required booking fields" },
        { status: 400 }
      );
    }

    // 1. Create the booking
    const booking = await createBooking(payload);

    if (!booking) {
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    // 2. Fetch car details for email
    const supabase = createSupabaseServiceRoleClient();
    const car = await carServiceSupabase.getCarById(supabase, payload.carId);

    if (!car || !car.name || !car.pricing?.base_price) {
      console.warn(
        `Car details not found for carId: ${payload.carId} or missing name/base_price. Email might be incomplete.`
      );
      // Proceed without sending email or send a generic one if critical info is missing
      // For now, we'll log a warning and the booking is still created.
    }

    // 3. Prepare data and call the email API
    // Ensure dates are in 'MMMM d, yyyy' format for the email
    const formattedStartDate = format(new Date(payload.startDate), "MMMM d, yyyy");
    const formattedEndDate = format(new Date(payload.endDate), "MMMM d, yyyy");
    const days = differenceInDays(new Date(payload.endDate), new Date(payload.startDate)) + 1;
    
    // The deposit isn't part of CreateBookingPayload, calculate it as 30% of total price
    // This matches the logic in the original booking form.
    const depositAmount = Math.round(payload.totalPrice * 0.3);


    const emailPayload = {
      customerName: `${payload.firstName} ${payload.lastName}`,
      customerEmail: payload.email,
      customerPhone: payload.phone || "",
      carName: car?.name || "Exotic Car", // Fallback car name
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      days: days,
      basePrice: car?.pricing?.base_price || 0, // Fallback base price
      totalPrice: payload.totalPrice,
      deposit: depositAmount, 
    };

    // We need the full URL for the fetch call to the email API
    const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";


    try {
      const emailResponse = await fetch(`${baseUrl}/api/email/booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.warn("Email sending warning (from /api/bookings/create):", errorData);
        // Don't fail the whole booking creation if email fails, just log it.
      }
    } catch (emailError) {
      console.error("Email sending error (from /api/bookings/create):", emailError);
    }

    return NextResponse.json({ success: true, booking }, { status: 201 });
  } catch (error: any) {
    console.error("Error in /api/bookings/create:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
} 