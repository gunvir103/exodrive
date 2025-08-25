import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { carServiceSupabase } from '@/lib/services/car-service-supabase';
import { withApiErrorHandling } from '@/lib/errors/error-middleware';
import { CarListResponseSchema } from '@/lib/validations/car-schemas';

// GET handler - fetch all cars including hidden ones
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  
  // Use service role client to bypass RLS policies
  const supabaseAdmin = createSupabaseServiceRoleClient();
  
  // Fetch all cars using the service
  const allCars = await carServiceSupabase.getAllCarsForAdminList(supabaseAdmin);
  
  // Log stats for monitoring
  console.log(`[Admin Cars] Found ${allCars.length} total cars`);
  const visibleCount = allCars.filter(car => !car.hidden).length;
  const hiddenCount = allCars.filter(car => car.hidden === true).length;
  console.log(`[Admin Cars] ${visibleCount} visible, ${hiddenCount} hidden`);
  
  // Validate response format
  const response = {
    cars: allCars,
    pagination: {
      page: 1,
      limit: allCars.length,
      total: allCars.length,
      totalPages: 1
    }
  };
  
  const validatedResponse = CarListResponseSchema.parse(response);
  
  // Return success response
  return NextResponse.json({
    success: true,
    ...validatedResponse
  });
}); 