import { NextResponse } from "next/server";
import { fetchBookings } from "@/lib/queries/bookings";

export async function GET() {
  try {
    const statuses = ["authorized", "active", "completed"];
    const bookingsData = await fetchBookings(statuses);
    return NextResponse.json({ success: true, bookings: bookingsData || [] });
  } catch (error: any) {
    console.error("Error fetching bookings for admin:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch bookings", bookings: [] },
      { status: 500 }
    );
  }
} 