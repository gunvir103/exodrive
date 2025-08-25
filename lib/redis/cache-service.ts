import { getRedisClient } from './redis-client';
import type { Redis } from '@upstash/redis';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix: string;
  invalidationEvents?: string[];
}

export interface CacheConfigs {
  carAvailability: CacheConfig;
  fleetListing: CacheConfig;
  carDetails: CacheConfig;
}

export const cacheConfigs: CacheConfigs = {
  carAvailability: {
    ttl: 300, // 5 minutes
    keyPrefix: 'availability:',
    invalidationEvents: ['booking.created', 'booking.cancelled'],
  },
  fleetListing: {
    ttl: 3600, // 1 hour
    keyPrefix: 'fleet:',
    invalidationEvents: ['car.updated', 'car.created', 'car.deleted'],
  },
  carDetails: {
    ttl: 1800, // 30 minutes
    keyPrefix: 'car:',
    invalidationEvents: ['car.updated'],
  },
};

export class CacheService {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.redis) {
        console.warn('[Cache] Redis client not available, falling back to no cache');
        return null;
      }

      const data = await this.redis.get(key);
      if (!data) return null;

      // Upstash Redis returns the parsed JSON directly
      return data as T;
    } catch (error) {
      console.error('[Cache] Error getting cache:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      if (!this.redis) {
        console.warn('[Cache] Redis client not available, skipping cache set');
        return false;
      }

      if (ttl && ttl > 0) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
      
      return true;
    } catch (error) {
      console.error('[Cache] Error setting cache:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (!this.redis) {
        console.warn('[Cache] Redis client not available, skipping cache delete');
        return false;
      }

      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('[Cache] Error deleting cache:', error);
      return false;
    }
  }

  async invalidate(pattern: string): Promise<number> {
    try {
      if (!this.redis) {
        console.warn('[Cache] Redis client not available, skipping cache invalidation');
        return 0;
      }

      // Use scan to find keys matching the pattern
      const keys: string[] = [];
      let cursor = 0;
      
      do {
        const result = await this.redis.scan(cursor, {
          match: pattern,
          count: 100
        });
        cursor = Number(result[0]);
        keys.push(...result[1]);
      } while (cursor !== 0);

      if (keys.length > 0) {
        const deletedCount = await this.redis.del(...keys);
        console.log(`[Cache] Invalidated ${deletedCount} keys matching pattern: ${pattern}`);
        return deletedCount;
      }

      return 0;
    } catch (error) {
      console.error('[Cache] Error invalidating cache:', error);
      return 0;
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    let totalDeleted = 0;
    
    for (const tag of tags) {
      const deleted = await this.invalidate(`*:${tag}:*`);
      totalDeleted += deleted;
    }
    
    return totalDeleted;
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.redis) {
        return false;
      }

      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Cache] Error checking existence:', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      if (!this.redis) {
        return -1;
      }

      return await this.redis.ttl(key);
    } catch (error) {
      console.error('[Cache] Error getting TTL:', error);
      return -1;
    }
  }

  async flush(): Promise<boolean> {
    try {
      if (!this.redis) {
        console.warn('[Cache] Redis client not available, skipping flush');
        return false;
      }

      await this.redis.flushdb();
      console.log('[Cache] Cache flushed successfully');
      return true;
    } catch (error) {
      console.error('[Cache] Error flushing cache:', error);
      return false;
    }
  }

  generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}${parts.join(':')}`;
  }

  isAvailable(): boolean {
    return this.redis !== null;
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Helper functions for common cache operations
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  const cached = await cacheService.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fetcher();
  await cacheService.set(key, fresh, ttl);
  return fresh;
}

export async function invalidateCacheByEvent(event: string): Promise<void> {
  const patterns: string[] = [];

  // Check each cache config for matching invalidation events
  for (const [configName, config] of Object.entries(cacheConfigs)) {
    if (config.invalidationEvents?.includes(event)) {
      patterns.push(`${config.keyPrefix}*`);
    }
  }

  // Invalidate all matching patterns
  for (const pattern of patterns) {
    await cacheService.invalidate(pattern);
  }
}