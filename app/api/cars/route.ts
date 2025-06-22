import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cacheService, cacheConfigs } from '@/lib/redis';
import { withApiErrorHandling } from '@/lib/errors';
import { publicRateLimit } from '@/lib/rate-limit';

async function getCars(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  // Generate cache key
  const cacheKey = cacheService.generateCacheKey(
    cacheConfigs.fleetListing.keyPrefix,
    'all'
  );

  // Try to get from cache
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    const response = NextResponse.json(cached);
    response.headers.set('X-Cache', 'HIT');
    return response;
  }

  // Fetch from database
  const { data: cars, error } = await supabase
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
    .eq('hidden', false)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cars:', error);
    throw error;
  }

  const responseData = {
    success: true,
    cars: cars || [],
    count: cars?.length || 0
  };

  // Cache the response
  await cacheService.set(cacheKey, responseData, cacheConfigs.fleetListing.ttl);

  const response = NextResponse.json(responseData);
  response.headers.set('X-Cache', 'MISS');
  return response;
}

// Export with error handling and rate limiting
export const GET = publicRateLimit(
  withApiErrorHandling(getCars)
);