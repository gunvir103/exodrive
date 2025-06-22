import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/lib/redis';
import { rateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { errors } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const results = {
      redis: {
        available: cacheService.isAvailable(),
        status: 'Testing Redis connection...'
      },
      cache: {
        test: null as any,
        ttl: null as any
      },
      rateLimit: {
        available: rateLimiter.isAvailable(),
        test: null as any
      },
      endpoints: {
        carAvailability: '/api/cars/availability?carId=<uuid>&startDate=2024-01-01&endDate=2024-01-07',
        fleetListing: '/api/cars',
        carDetails: '/api/cars/<uuid>'
      },
      features: [
        '✅ Redis caching with TTL management',
        '✅ Car availability endpoint (5 min cache)',
        '✅ Fleet listing endpoint (1 hour cache)',
        '✅ Car details endpoint (30 min cache)',
        '✅ Cache invalidation on booking events',
        '✅ Standardized error handling with trace IDs',
        '✅ Rate limiting (60/min public, 120/min auth, 10/hr booking)',
        '✅ Rate limit headers (X-RateLimit-*)',
        '✅ Graceful fallback when Redis unavailable'
      ]
    };

    // Test Redis if available
    if (cacheService.isAvailable()) {
      const testKey = 'demo:test';
      const testData = { message: 'Redis working!', timestamp: new Date().toISOString() };
      
      await cacheService.set(testKey, testData, 60);
      results.cache.test = await cacheService.get(testKey);
      results.cache.ttl = await cacheService.ttl(testKey);
      results.redis.status = '✅ Connected and working';
      
      // Test rate limiting
      const demoIp = request.headers.get('x-forwarded-for') || 'demo-user';
      const rateLimitResult = await rateLimiter.checkLimit(demoIp, rateLimitConfigs.public);
      results.rateLimit.test = {
        allowed: rateLimitResult.allowed,
        remaining: rateLimitResult.remaining,
        limit: rateLimitResult.limit,
        resetAt: rateLimitResult.resetAt
      };
    } else {
      results.redis.status = '⚠️ Not connected (check env vars)';
    }

    const response = NextResponse.json({
      success: true,
      message: 'Redis implementation demo',
      results
    });

    // Add rate limit headers if available
    if (results.rateLimit.test) {
      response.headers.set('X-RateLimit-Limit', results.rateLimit.test.limit.toString());
      response.headers.set('X-RateLimit-Remaining', results.rateLimit.test.remaining.toString());
      response.headers.set('X-RateLimit-Reset', results.rateLimit.test.resetAt.toISOString());
    }

    return response;
  } catch (error) {
    throw errors.internalError('Demo failed');
  }
}