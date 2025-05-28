import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Define the schema for request validation
const availabilityQuerySchema = z.object({
  car_id: z.string().uuid(),
  start_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  end_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "End date must be in YYYY-MM-DD format"),
});

// Define an interface for the car availability record
interface CarAvailabilityRecord {
  date: string;
  status: 'available' | 'pending_confirmation' | 'booked' | 'maintenance' | string; // Added string for safety, Supabase might return other values
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());

  // Validate query parameters
  const validationResult = availabilityQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
  }

  const { car_id, start_date, end_date } = validationResult.data;

  if (new Date(start_date) > new Date(end_date)) {
    return NextResponse.json({ error: 'Start date cannot be after end date' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient(request.cookies as any);

  try {
    const { data: carAvailability, error } = await supabase
      .from('car_availability')
      .select('date, status')
      .eq('car_id', car_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('date', { ascending: true });

    if (error) {
      console.error('Supabase error fetching car availability:', error);
      return NextResponse.json({ error: 'Failed to fetch car availability', details: error.message }, { status: 500 });
    }

    // Process the data to create a list of all dates in the range
    // and mark their availability.
    const availabilityMap = new Map<string, string>();
    carAvailability?.forEach((record: CarAvailabilityRecord) => {
      if (record.date && record.status) {
        availabilityMap.set(record.date, record.status);
      }
    });

    const results: { date: string; available: boolean; status?: string }[] = [];
    const currentDate = new Date(start_date);
    const lastDate = new Date(end_date);

    while (currentDate <= lastDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      const status = availabilityMap.get(dateString);

      // A date is unavailable if its status is 'pending_confirmation', 'booked', or 'maintenance'.
      // If a date is not in our car_availability table, we assume it's 'available' by default.
      const isAvailable = !status || status === 'available';
      
      results.push({
        date: dateString,
        available: isAvailable,
        status: status || 'available', // Return the actual status or 'available' if not present
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json(results, { status: 200 });

  } catch (e: any) {
    console.error('Error in car availability endpoint:', e);
    return NextResponse.json({ error: 'An unexpected error occurred', details: e.message }, { status: 500 });
  }
} 