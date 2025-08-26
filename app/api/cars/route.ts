import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cacheService, cacheConfigs } from '@/lib/redis';
import { withApiErrorHandling } from '@/lib/errors';
import { publicRateLimit } from '@/lib/rate-limit';

async function getCars(request: NextRequest) {
  const supabase = createSupabaseServerClient(request.cookies as any);
  
  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const minPrice = searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : null;
  const maxPrice = searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : null;
  const features = searchParams.get('features')?.split(',').filter(Boolean) || [];
  const sortBy = searchParams.get('sortBy') || 'featured';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')));
  const offset = (page - 1) * limit;

  // Generate cache key based on all parameters
  const cacheKey = cacheService.generateCacheKey(
    cacheConfigs.fleetListing.keyPrefix,
    `search-${search}-cat-${category}-price-${minPrice}-${maxPrice}-features-${features.join(',')}-sort-${sortBy}-${sortOrder}-page-${page}-limit-${limit}`
  );

  // Try to get from cache
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    const response = NextResponse.json(cached);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Cache-Key', cacheKey);
    return response;
  }

  try {
    // Start building query
    let query = supabase
      .from('cars')
      .select(`
        id,
        slug,
        name,
        category,
        short_description,
        available,
        featured,
        created_at,
        pricing:car_pricing(base_price),
        images:car_images(url, is_primary, sort_order),
        features:car_features(name)
      `)
      .eq('available', true)
      .eq('hidden', false);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,short_description.ilike.%${search}%`);
    }

    // Apply category filter
    if (category) {
      query = query.eq('category', category);
    }

    // Apply sorting
    switch (sortBy) {
      case 'price':
        // Note: We'll sort in JavaScript after fetching since we need to join with pricing
        break;
      case 'name':
        query = query.order('name', { ascending: sortOrder === 'asc' });
        break;
      case 'featured':
      default:
        query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
        break;
    }

    // Execute main query
    const { data: cars, error } = await query;
    if (error) throw error;

    // Process the data
    let processedCars = (cars || []).map((car: any) => {
      // Find primary image
      const primaryImage = car.images?.find((img: any) => img.is_primary) || car.images?.[0];
      
      // Get price
      const price = Array.isArray(car.pricing) ? car.pricing[0]?.base_price : car.pricing?.base_price;
      
      // Get feature names
      const carFeatures = car.features?.map((f: any) => f.name) || [];

      return {
        id: car.id,
        slug: car.slug,
        name: car.name,
        category: car.category,
        shortDescription: car.short_description,
        available: car.available,
        featured: car.featured,
        created_at: car.created_at,
        primary_image_url: primaryImage?.url,
        price_per_day: price,
        features: carFeatures
      };
    });

    // Apply price filtering
    if (minPrice !== null || maxPrice !== null) {
      processedCars = processedCars.filter((car: any) => {
        const price = car.price_per_day;
        if (price === null || price === undefined) return false;
        if (minPrice !== null && price < minPrice) return false;
        if (maxPrice !== null && price > maxPrice) return false;
        return true;
      });
    }

    // Apply features filtering
    if (features.length > 0) {
      processedCars = processedCars.filter((car: any) => 
        features.every(feature => car.features.includes(feature))
      );
    }

    // Apply price sorting if needed
    if (sortBy === 'price') {
      processedCars.sort((a: any, b: any) => {
        const priceA = a.price_per_day || 0;
        const priceB = b.price_per_day || 0;
        return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
      });
    }

    // Apply pagination
    const totalItems = processedCars.length;
    const paginatedCars = processedCars.slice(offset, offset + limit);

    const responseData = {
      success: true,
      cars: paginatedCars,
      pagination: {
        page,
        limit,
        total: totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNext: page < Math.ceil(totalItems / limit),
        hasPrev: page > 1
      },
      filters: {
        search,
        category,
        minPrice,
        maxPrice,
        features,
        sortBy,
        sortOrder
      }
    };

    // Cache the response (shorter TTL for search results)
    await cacheService.set(cacheKey, responseData, 300); // 5 minutes

    const response = NextResponse.json(responseData);
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('X-Cache-Key', cacheKey);
    return response;

  } catch (error) {
    console.error('Error fetching cars:', error);
    throw error;
  }
}

// Export with error handling and rate limiting
export const GET = publicRateLimit(
  withApiErrorHandling(getCars)
);