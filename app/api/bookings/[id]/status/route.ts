import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { TablesUpdate, Database } from "@/lib/supabase/database.types";

interface StatusUpdatePayload {
  status: Database["public"]["Enums"]["booking_status_enum"];
  payment_status?: Database["public"]["Enums"]["payment_status_enum"];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const bookingId = params.id;
  if (!bookingId) {
    return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as StatusUpdatePayload;
    if (!payload.status) {
      return NextResponse.json(
        { error: "New status is required in payload" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const updateData: TablesUpdate<"bookings"> = { status: payload.status };

    if (payload.payment_status) {
        updateData.payment_status = payload.payment_status;
    }

    if (payload.status === 'booked' && updateData.payment_status !== 'captured' && updateData.payment_status !== 'refunded') {
        const { data: currentBooking, error: fetchError } = await supabase
            .from('bookings')
            .select('payment_status')
            .eq('id', bookingId)
            .single();
        
        if (fetchError) {
            console.warn("Error fetching current booking for status update (defaults to captured if 'booked'):", fetchError.message);
        }

        if (currentBooking && currentBooking.payment_status !== 'captured' && currentBooking.payment_status !== 'refunded') {
            updateData.payment_status = 'captured';
        } else if (!currentBooking) {
            updateData.payment_status = 'captured';
        }
    }

    const { data, error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId)
      .select()
      .single();

    if (error) {
      console.error("Supabase error updating booking status:", error);
      return NextResponse.json(
        { error: `Failed to update booking status: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: `Booking with ID ${bookingId} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, booking: data });

  } catch (error: any) {
    console.error("Error processing booking status update:", error);
    if (error.name === 'SyntaxError') {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
} 