import { getRedisClient } from '../redis/redis-client';
import type { Redis } from '@upstash/redis';

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  max: number;           // Max requests per window
  keyGenerator: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableDualLimit?: boolean; // Enable both IP and user-based limiting
  onViolation?: (identifier: string, limit: number, windowMs: number) => void; // Monitoring callback
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter: number | null; // seconds until retry
}

export const rateLimitConfigs = {
  public: {
    windowMs: 60000,  // 1 minute
    max: 60,          // 60 requests per minute
    keyGenerator: (ip: string) => `rate:public:${ip}`,
  },
  authenticated: {
    windowMs: 60000,  // 1 minute
    max: 120,         // 120 requests per minute
    keyGenerator: (userId: string) => `rate:auth:${userId}`,
  },
  booking: {
    windowMs: 3600000,  // 1 hour
    max: 10,            // 10 bookings per hour
    keyGenerator: (userId: string) => `rate:booking:${userId}`,
  },
  // Stricter payment endpoint limits
  paymentEndpoints: {
    windowMs: 60000,  // 1 minute
    max: 10,          // 10 requests per minute
    keyGenerator: (identifier: string) => `rate:payment:${identifier}`,
    enableDualLimit: true,
    onViolation: (identifier, limit, windowMs) => {
      console.warn(`[RateLimiter] Payment endpoint rate limit violation: ${identifier} exceeded ${limit} requests in ${windowMs}ms`);
    },
  },
  // Car upload limits
  carUpload: {
    windowMs: 60000,  // 1 minute
    max: 5,           // 5 uploads per minute per user
    keyGenerator: (userId: string) => `rate:upload:${userId}`,
    onViolation: (userId, limit, windowMs) => {
      console.warn(`[RateLimiter] Upload rate limit violation: ${userId} exceeded ${limit} uploads in ${windowMs}ms`);
    },
  },
  // Webhook rate limits
  webhook: {
    windowMs: 60000,  // 1 minute
    max: 100,         // 100 webhook requests per minute
    keyGenerator: (identifier: string) => `rate:webhook:${identifier}`,
  },
  // Admin endpoint limits
  admin: {
    windowMs: 60000,  // 1 minute
    max: 300,         // 300 requests per minute
    keyGenerator: (userId: string) => `rate:admin:${userId}`,
  },
};

export class RateLimiter {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
  }

  async checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    // If Redis is not available, allow the request but log a warning
    if (!this.redis) {
      console.warn('[RateLimiter] Redis not available, allowing request');
      return {
        allowed: true,
        limit: config.max,
        remaining: config.max,
        resetAt: new Date(Date.now() + config.windowMs),
        retryAfter: null,
      };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = config.keyGenerator(identifier);

    try {
      // Use Redis sorted sets for sliding window rate limiting
      const pipe = this.redis.pipeline();
      
      // Remove old entries outside the window
      pipe.zremrangebyscore(key, '-inf', windowStart.toString());
      
      // Add current request
      const requestId = `${now}-${Math.random()}`;
      pipe.zadd(key, { score: now, member: requestId });
      
      // Count requests in window
      pipe.zcard(key);
      
      // Set expiration
      pipe.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await pipe.exec();
      const count = results[2] as number;

      const remaining = Math.max(0, config.max - count);
      const resetAt = new Date(now + config.windowMs);
      const allowed = count <= config.max;

      // Trigger violation callback if limit exceeded
      if (!allowed && config.onViolation) {
        config.onViolation(identifier, config.max, config.windowMs);
      }

      // If not allowed, calculate retry after
      let retryAfter: number | null = null;
      if (!allowed) {
        // Get the oldest request timestamp in the window
        const oldestRequest = await this.redis.zrange(key, 0, 0, {
          withScores: true,
        });
        
        if (oldestRequest && oldestRequest.length >= 2) {
          const oldestTimestamp = Number(oldestRequest[1]);
          const whenAllowed = oldestTimestamp + config.windowMs;
          retryAfter = Math.ceil((whenAllowed - now) / 1000);
        } else {
          retryAfter = Math.ceil(config.windowMs / 1000);
        }
      }

      return {
        allowed,
        limit: config.max,
        remaining,
        resetAt,
        retryAfter,
      };
    } catch (error) {
      console.error('[RateLimiter] Error checking rate limit:', error);
      // On error, allow the request
      return {
        allowed: true,
        limit: config.max,
        remaining: config.max,
        resetAt: new Date(now + config.windowMs),
        retryAfter: null,
      };
    }
  }

  async reset(identifier: string, config: RateLimitConfig): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    const key = config.keyGenerator(identifier);
    
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('[RateLimiter] Error resetting rate limit:', error);
      return false;
    }
  }

  async getRemainingRequests(
    identifier: string,
    config: RateLimitConfig
  ): Promise<number> {
    if (!this.redis) {
      return config.max;
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = config.keyGenerator(identifier);

    try {
      // Remove old entries and count current ones
      await this.redis.zremrangebyscore(key, '-inf', windowStart.toString());
      const count = await this.redis.zcard(key);
      
      return Math.max(0, config.max - count);
    } catch (error) {
      console.error('[RateLimiter] Error getting remaining requests:', error);
      return config.max;
    }
  }

  isAvailable(): boolean {
    return this.redis !== null;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();