import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkAdminApiAuth } from '@/lib/auth/admin-api-check';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const { isValid, response, user } = await checkAdminApiAuth(request.cookies);
    if (!isValid || !user) return response!;
    
    const supabase = createSupabaseServerClient(request.cookies);

    // Get current date info for comparison
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Previous month for comparison
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const currentMonthStart = new Date(currentYear, currentMonth, 1).toISOString();
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
    const prevMonthStart = new Date(prevYear, prevMonth, 1).toISOString();
    const prevMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();

    // Fetch analytics data in parallel
    const [
      totalRevenueResult,
      prevMonthRevenueResult,
      activeBookingsResult,
      prevMonthActiveBookingsResult,
      totalCarsResult,
      availableCarsResult,
      totalCustomersResult,
      prevMonthCustomersResult,
      recentBookingsResult,
      popularCarsResult
    ] = await Promise.all([
      // Total revenue (current month)
      supabase
        .from('bookings')
        .select('total_price')
        .gte('created_at', currentMonthStart)
        .lte('created_at', currentMonthEnd)
        .in('payment_status', ['paid', 'captured']),

      // Previous month revenue
      supabase
        .from('bookings')
        .select('total_price')
        .gte('created_at', prevMonthStart)
        .lte('created_at', prevMonthEnd)
        .in('payment_status', ['paid', 'captured']),

      // Active bookings count
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('overall_status', 'active'),

      // Previous month active bookings (at the end of prev month)
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('overall_status', 'active')
        .lte('created_at', prevMonthEnd),

      // Total cars
      supabase
        .from('cars')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Available cars (simplified - cars not currently booked)
      supabase
        .from('cars')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Total customers (current month)
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', currentMonthStart)
        .lte('created_at', currentMonthEnd),

      // Previous month customers  
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', prevMonthStart)
        .lte('created_at', prevMonthEnd),

      // Recent bookings (last 5)
      supabase
        .from('bookings')
        .select(`
          id,
          start_date,
          end_date,
          total_price,
          overall_status,
          customer:customers!bookings_customer_id_fkey (
            first_name,
            last_name
          ),
          car:cars!bookings_car_id_fkey (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5),

      // Popular cars (most booked)
      supabase
        .from('bookings')
        .select(`
          car_id,
          total_price,
          car:cars!bookings_car_id_fkey (
            id,
            name,
            status
          )
        `)
        .not('car', 'is', null)
    ]);

    // Calculate revenue totals
    const currentRevenue = totalRevenueResult.data?.reduce((sum, booking) => sum + (booking.total_price || 0), 0) || 0;
    const prevRevenue = prevMonthRevenueResult.data?.reduce((sum, booking) => sum + (booking.total_price || 0), 0) || 0;
    const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Calculate booking changes
    const currentActiveBookings = activeBookingsResult.count || 0;
    const prevActiveBookings = prevMonthActiveBookingsResult.count || 0;
    const bookingsChange = prevActiveBookings > 0 ? currentActiveBookings - prevActiveBookings : currentActiveBookings;

    // Calculate customer changes
    const currentCustomers = totalCustomersResult.count || 0;
    const prevCustomers = prevMonthCustomersResult.count || 0;
    const customersChange = currentCustomers - prevCustomers;

    // Process popular cars data
    const carBookingsMap = new Map();
    popularCarsResult.data?.forEach(booking => {
      if (booking.car && Array.isArray(booking.car) && booking.car.length > 0) {
        const car = booking.car[0]; // Get first car from array
        const carId = car.id;
        if (!carBookingsMap.has(carId)) {
          carBookingsMap.set(carId, {
            id: carId,
            name: car.name,
            status: car.status,
            bookings: 0,
            revenue: 0
          });
        }
        const carData = carBookingsMap.get(carId);
        carData.bookings += 1;
        carData.revenue += booking.total_price || 0;
      }
    });

    const popularCars = Array.from(carBookingsMap.values())
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 4)
      .map(car => ({
        id: car.id,
        name: car.name,
        bookings: car.bookings,
        revenue: `$${car.revenue.toLocaleString()}`,
        availability: car.status === 'active' ? 'Available' : 'Unavailable'
      }));

    // Format recent bookings
    const recentBookings = recentBookingsResult.data?.map(booking => ({
      id: booking.id,
      customer: booking.customer && Array.isArray(booking.customer) && booking.customer.length > 0
        ? `${booking.customer[0].first_name} ${booking.customer[0].last_name}`.trim()
        : 'Unknown Customer',
      car: booking.car && Array.isArray(booking.car) && booking.car.length > 0
        ? booking.car[0].name || 'Unknown Car'
        : 'Unknown Car',
      startDate: booking.start_date,
      endDate: booking.end_date,
      status: booking.overall_status,
      total: `$${(booking.total_price || 0).toLocaleString()}`
    })) || [];

    // Prepare stats
    const stats = [
      {
        title: "Total Revenue",
        value: `$${currentRevenue.toLocaleString()}`,
        change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`,
        trend: revenueChange >= 0 ? "up" : "down",
        description: "vs. previous month",
        icon: "DollarSign"
      },
      {
        title: "Active Bookings", 
        value: currentActiveBookings.toString(),
        change: `${bookingsChange >= 0 ? '+' : ''}${bookingsChange}`,
        trend: bookingsChange >= 0 ? "up" : "down",
        description: "vs. previous month",
        icon: "Calendar"
      },
      {
        title: "Available Cars",
        value: (totalCarsResult.count || 0).toString(),
        change: "0", // We don't track historical car counts yet
        trend: "up",
        description: "total fleet",
        icon: "Car"
      },
      {
        title: "New Customers",
        value: currentCustomers.toString(),
        change: `${customersChange >= 0 ? '+' : ''}${customersChange}`,
        trend: customersChange >= 0 ? "up" : "down", 
        description: "this month",
        icon: "Users"
      }
    ];

    return NextResponse.json({
      stats,
      recentBookings,
      popularCars
    });

  } catch (error: any) {
    console.error('Error in admin analytics endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}