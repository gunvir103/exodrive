import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { carServiceSupabase } from '@/lib/services/car-service-supabase';

// GET handler - fetch all cars including hidden ones
export async function GET() {
  console.log('API: GET /api/admin/cars called');
  
  try {
    // Use service role client to bypass RLS policies
    const supabaseAdmin = createSupabaseServiceRoleClient();
    
    // Fetch all cars using the service
    const allCars = await carServiceSupabase.getAllCarsForAdminList(supabaseAdmin);
    
    // Log stats
    console.log(`API: Found ${allCars.length} total cars`);
    const visibleCount = allCars.filter(car => !car.hidden).length;
    const hiddenCount = allCars.filter(car => car.hidden === true).length;
    console.log(`API: ${visibleCount} visible, ${hiddenCount} hidden`);
    
    // Return success response with all cars
    return NextResponse.json({ 
      success: true, 
      cars: allCars 
    });
    
  } catch (error: any) {
    console.error('API: Error fetching all cars for admin:', error);
    
    // Return error response
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch cars' 
      },
      { status: 500 }
    );
  }
} 