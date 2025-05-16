import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { Tables, TablesInsert } from "@/lib/supabase/database.types"

// Helpers assume they are executed on the server (RSC / Route Handlers)

/**
 * Fetch pending bookings for the admin inbox ordered by newest first.
 */
export async function fetchAdminInbox() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `*, car:cars(id, name, slug, car_images(url, is_primary)), customer:customers(id, first_name, last_name, email, phone)`
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return data as any[]
}

/**
 * Fetch bookings by status. Status array optional; empty array returns all.
 */
export async function fetchBookings(statuses: string[] = []) {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("bookings")
    .select(
      `*, car:cars(id, name, slug, car_images(url, is_primary)), customer:customers(id, first_name, last_name, email, phone)`
    )
    .order("created_at", { ascending: false })
  if (statuses.length) {
    query = query.in("status", statuses)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function fetchBookingById(id: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `*, car:cars(id, name, slug, car_images(url, is_primary)), customer:customers(id, first_name, last_name, email, phone)`
    )
    .eq("id", id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

export interface CreateBookingPayload {
  carId: string
  startDate: string // ISO date string (YYYY-MM-DD)
  endDate: string // ISO
  firstName: string
  lastName: string
  email: string
  phone?: string
  totalPrice: number
  currency?: string
  notes?: string
}

/**
 * Creates customer (upsert) + booking + availability rows.
 * Returns the created booking row.
 */
export async function createBooking(payload: CreateBookingPayload) {
  const {
    carId,
    startDate,
    endDate,
    firstName,
    lastName,
    email,
    phone,
    totalPrice,
    currency = "USD",
    notes,
  } = payload

  const supabase = createSupabaseServiceRoleClient()
  // 1) Upsert customer by email
  const { data: customerData, error: customerErr } = await supabase
    .from("customers")
    .upsert(
      {
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? null,
      },
      { onConflict: "email" }
    )
    .select()
    .single()
  if (customerErr || !customerData) throw new Error(customerErr?.message || "Customer upsert failed")

  // 2) Insert booking
  const bookingInsert: TablesInsert<"bookings"> = {
    car_id: carId,
    customer_id: customerData.id,
    start_date: startDate,
    end_date: endDate,
    total_price: totalPrice,
    currency,
    notes: notes ?? null,
  }
  const { data: bookingData, error: bookingErr } = await supabase
    .from("bookings")
    .insert(bookingInsert)
    .select()
    .single()
  if (bookingErr || !bookingData) throw new Error(bookingErr?.message || "Booking insert failed")

  // 3) Insert availability rows (status = pending)
  const rangeDates: string[] = getDateRange(startDate, endDate)
  const availabilityRows = rangeDates.map((d) => ({
    car_id: carId,
    date: d,
    status: "pending",
    booking_id: bookingData.id,
  })) as TablesInsert<"car_availability">[]

  const { error: availErr } = await supabase
    .from("car_availability")
    .upsert(availabilityRows, { onConflict: "car_id,date" })
  if (availErr) {
    // Optionally rollback booking
    console.error("Error inserting availability rows", availErr)
  }

  return bookingData
}

function getDateRange(start: string, end: string) {
  const arr: string[] = []
  const startDate = new Date(start)
  const endDate = new Date(end)
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    arr.push(d.toISOString().slice(0, 10))
  }
  return arr
} 