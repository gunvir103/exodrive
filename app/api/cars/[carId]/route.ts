import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { cacheService, cacheConfigs } from '@/lib/redis';
import { withApiErrorHandling } from '@/lib/errors';
import { publicRateLimit } from '@/lib/rate-limit';
import { errors } from '@/lib/errors';

const paramsSchema = z.object({
  carId: z.string().uuid('Invalid car ID')
});

async function getCarDetails(
  request: NextRequest,
  { params }: { params: { carId: string } }
) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  // Validate params
  const validationResult = paramsSchema.safeParse(params);
  if (!validationResult.success) {
    throw errors.validationError('Invalid request parameters', validationResult.error.flatten());
  }

  const { carId } = validationResult.data;

  // Generate cache key
  const cacheKey = cacheService.generateCacheKey(
    cacheConfigs.carDetails.keyPrefix,
    carId
  );

  // Try to get from cache
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    const response = NextResponse.json(cached);
    response.headers.set('X-Cache', 'HIT');
    return response;
  }

  // Fetch from database
  const { data: car, error } = await supabase
    .from('cars')
    .select(`
      *,
      category:categories(
        id,
        name,
        slug,
        description
      )
    `)
    .eq('id', carId)
    .eq('hidden', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw errors.notFound('Car');
    }
    console.error('Error fetching car details:', error);
    throw error;
  }

  if (!car) {
    throw errors.notFound('Car');
  }

  const responseData = {
    success: true,
    car
  };

  // Cache the response
  await cacheService.set(cacheKey, responseData, cacheConfigs.carDetails.ttl);

  const response = NextResponse.json(responseData);
  response.headers.set('X-Cache', 'MISS');
  return response;
}

// Export with error handling and rate limiting
export const GET = publicRateLimit(
  withApiErrorHandling(getCarDetails)
);