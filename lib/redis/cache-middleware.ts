import { NextRequest, NextResponse } from 'next/server';
import { cacheService, CacheConfig } from './cache-service';
import { createHash } from 'crypto';

export interface CacheMiddlewareOptions extends Partial<CacheConfig> {
  generateKey?: (req: NextRequest) => string;
  shouldCache?: (req: NextRequest) => boolean;
  cacheCondition?: (data: any) => boolean;
}

function generateCacheKey(req: NextRequest, prefix: string): string {
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;
  const searchParams = url.searchParams.toString();
  
  // Create a hash of the request details
  const keyData = `${method}:${pathname}:${searchParams}`;
  const hash = createHash('sha256').update(keyData).digest('hex').substring(0, 16);
  
  return `${prefix}${hash}`;
}

export function withCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: CacheMiddlewareOptions = {}
) {
  const {
    ttl = 300,
    keyPrefix = 'api:',
    generateKey: customKeyGenerator,
    shouldCache = (req) => req.method === 'GET',
    cacheCondition = () => true,
  } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
    // Skip caching if Redis is not available
    if (!cacheService.isAvailable()) {
      console.warn('[CacheMiddleware] Redis not available, bypassing cache');
      return handler(req);
    }

    // Check if request should be cached
    if (!shouldCache(req)) {
      return handler(req);
    }

    // Generate cache key
    const cacheKey = customKeyGenerator 
      ? customKeyGenerator(req)
      : generateCacheKey(req, keyPrefix);

    try {
      // Try to get from cache
      const cached = await cacheService.get<any>(cacheKey);
      if (cached !== null) {
        console.log(`[CacheMiddleware] Cache HIT for key: ${cacheKey}`);
        const response = NextResponse.json(cached);
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-Key', cacheKey);
        return response;
      }
    } catch (error) {
      console.error('[CacheMiddleware] Error reading from cache:', error);
      // Continue without cache on error
    }

    console.log(`[CacheMiddleware] Cache MISS for key: ${cacheKey}`);
    
    // Execute the handler
    const response = await handler(req);
    
    // Only cache successful responses
    if (response.status >= 200 && response.status < 300) {
      try {
        // Clone the response to read the body
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        
        // Check if data should be cached
        if (cacheCondition(data)) {
          await cacheService.set(cacheKey, data, ttl);
          console.log(`[CacheMiddleware] Cached response for key: ${cacheKey} with TTL: ${ttl}s`);
        }
      } catch (error) {
        console.error('[CacheMiddleware] Error caching response:', error);
        // Continue without caching on error
      }
    }

    // Add cache headers
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('X-Cache-Key', cacheKey);
    
    return response;
  };
}

// Helper to create cache middleware for specific endpoints
export function createCacheMiddleware(configName: keyof typeof import('./cache-service').cacheConfigs) {
  const config = require('./cache-service').cacheConfigs[configName];
  
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return withCache(handler, {
      ttl: config.ttl,
      keyPrefix: config.keyPrefix,
    });
  };
}

// Cache invalidation helper for Next.js API routes
export async function invalidateApiCache(patterns: string[]): Promise<void> {
  const invalidationPromises = patterns.map(pattern => 
    cacheService.invalidate(pattern)
  );
  
  const results = await Promise.all(invalidationPromises);
  const totalInvalidated = results.reduce((sum, count) => sum + count, 0);
  
  console.log(`[CacheMiddleware] Invalidated ${totalInvalidated} cache entries`);
}

// Decorator-style cache wrapper for async functions
export function cacheable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    ttl?: number;
    keyGenerator: (...args: Parameters<T>) => string;
  }
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = options.keyGenerator(...args);
    
    // Try to get from cache
    const cached = await cacheService.get(key);
    if (cached !== null) {
      return cached as ReturnType<T>;
    }
    
    // Execute function and cache result
    const result = await fn(...args);
    await cacheService.set(key, result, options.ttl);
    
    return result;
  }) as T;
}