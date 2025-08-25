import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { RateLimiter, RateLimitConfig } from '../../lib/rate-limit/rate-limiter';
import { getRedisClient } from '../../lib/redis/redis-client';
import type { Redis } from '@upstash/redis';

// Mock configurations for testing
const testConfigs = {
  public: {
    windowMs: 60000, // 1 minute
    max: 60, // 60 requests per minute
    keyGenerator: (ip: string) => `test:rate:public:${ip}`,
  },
  authenticated: {
    windowMs: 60000, // 1 minute
    max: 120, // 120 requests per minute
    keyGenerator: (userId: string) => `test:rate:auth:${userId}`,
  },
  booking: {
    windowMs: 3600000, // 1 hour
    max: 10, // 10 bookings per hour
    keyGenerator: (userId: string) => `test:rate:booking:${userId}`,
  },
  // Fast window for testing reset behavior
  fastWindow: {
    windowMs: 2000, // 2 seconds
    max: 5, // 5 requests per 2 seconds
    keyGenerator: (id: string) => `test:rate:fast:${id}`,
  }
};

describe('Rate Limiting Load Tests', () => {
  let rateLimiter: RateLimiter;
  let redis: Redis | null;

  beforeAll(async () => {
    rateLimiter = new RateLimiter();
    redis = getRedisClient();

    // Clean up any existing test keys
    if (redis) {
      const testKeys = await redis.keys('test:rate:*');
      if (testKeys.length > 0) {
        await redis.del(...testKeys);
      }
    }
  });

  afterAll(async () => {
    // Clean up test keys
    if (redis) {
      const testKeys = await redis.keys('test:rate:*');
      if (testKeys.length > 0) {
        await redis.del(...testKeys);
      }
    }
  });

  describe('1. Public endpoint rate limit (60 req/min)', () => {
    it('should handle rapid fire 70 requests correctly', async () => {
      const testIp = '192.168.1.100';
      const config = testConfigs.public;
      
      // Create 70 concurrent requests
      const requests = Array.from({ length: 70 }, (_, i) => 
        rateLimiter.checkLimit(testIp, config)
      );

      const results = await Promise.all(requests);

      // Count allowed and denied requests
      const allowed = results.filter(r => r.allowed).length;
      const denied = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(60);
      expect(denied).toBe(10);

      // Verify all denied requests have retry-after header
      const deniedResults = results.filter(r => !r.allowed);
      deniedResults.forEach(result => {
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.retryAfter).toBeLessThanOrEqual(60);
      });

      // Verify remaining count accuracy
      const lastAllowedResult = results.filter(r => r.allowed).pop();
      expect(lastAllowedResult?.remaining).toBe(0);
    });

    it('should show accurate rate limit headers throughout the window', async () => {
      const testIp = '192.168.1.101';
      const config = testConfigs.public;

      // Make 30 requests
      for (let i = 0; i < 30; i++) {
        const result = await rateLimiter.checkLimit(testIp, config);
        
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(60);
        expect(result.remaining).toBe(59 - i);
        expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
      }
    });
  });

  describe('2. Authenticated endpoint rate limit (120 req/min)', () => {
    it('should handle different rate limit for authenticated users', async () => {
      const userId = 'user-123';
      const config = testConfigs.authenticated;

      // Create 130 concurrent requests
      const requests = Array.from({ length: 130 }, () => 
        rateLimiter.checkLimit(userId, config)
      );

      const results = await Promise.all(requests);

      const allowed = results.filter(r => r.allowed).length;
      const denied = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(120);
      expect(denied).toBe(10);

      // Verify headers
      const lastResult = results[results.length - 1];
      expect(lastResult.limit).toBe(120);
      expect(lastResult.remaining).toBe(0);
    });

    it('should isolate rate limits between different users', async () => {
      const user1 = 'user-456';
      const user2 = 'user-789';
      const config = testConfigs.authenticated;

      // User 1 makes 120 requests
      const user1Requests = Array.from({ length: 120 }, () => 
        rateLimiter.checkLimit(user1, config)
      );
      await Promise.all(user1Requests);

      // User 2 should still be able to make requests
      const user2Result = await rateLimiter.checkLimit(user2, config);
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.remaining).toBe(119);

      // User 1 should be rate limited
      const user1ExtraResult = await rateLimiter.checkLimit(user1, config);
      expect(user1ExtraResult.allowed).toBe(false);
      expect(user1ExtraResult.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('3. Booking endpoint rate limit (10 req/hr)', () => {
    it('should enforce hourly limit correctly', async () => {
      const userId = 'booking-user-123';
      const config = testConfigs.booking;

      // Make 15 concurrent booking requests
      const requests = Array.from({ length: 15 }, () => 
        rateLimiter.checkLimit(userId, config)
      );

      const results = await Promise.all(requests);

      const allowed = results.filter(r => r.allowed).length;
      const denied = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(10);
      expect(denied).toBe(5);

      // Verify long retry-after for hourly limit
      const deniedResult = results.find(r => !r.allowed);
      expect(deniedResult?.retryAfter).toBeGreaterThan(0);
      expect(deniedResult?.retryAfter).toBeLessThanOrEqual(3600);
    });

    it('should maintain accurate count over extended period', async () => {
      const userId = 'booking-user-456';
      const config = testConfigs.booking;

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit(userId, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i);
      }

      // Check remaining requests
      const remaining = await rateLimiter.getRemainingRequests(userId, config);
      expect(remaining).toBe(5);

      // Make 5 more requests
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit(userId, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }

      // 11th request should be denied
      const deniedResult = await rateLimiter.checkLimit(userId, config);
      expect(deniedResult.allowed).toBe(false);
    });
  });

  describe('4. Sliding window behavior', () => {
    it('should correctly implement sliding window counting', async () => {
      const testId = 'sliding-window-test';
      const config = testConfigs.fastWindow; // 5 requests per 2 seconds

      // Make 5 requests immediately
      const initialRequests = Array.from({ length: 5 }, () => 
        rateLimiter.checkLimit(testId, config)
      );
      const initialResults = await Promise.all(initialRequests);
      
      expect(initialResults.every(r => r.allowed)).toBe(true);

      // 6th request should be denied
      const deniedResult = await rateLimiter.checkLimit(testId, config);
      expect(deniedResult.allowed).toBe(false);

      // Wait 1 second (half the window)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should still be denied (sliding window)
      const stillDeniedResult = await rateLimiter.checkLimit(testId, config);
      expect(stillDeniedResult.allowed).toBe(false);

      // Wait another 1.5 seconds (total 2.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Now some requests should be allowed as old ones slide out
      const newResult = await rateLimiter.checkLimit(testId, config);
      expect(newResult.allowed).toBe(true);
    });

    it('should handle request timestamps correctly in sliding window', async () => {
      const testId = 'sliding-window-timestamps';
      const config = testConfigs.fastWindow;

      // Make requests with slight delays
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit(testId, config);
        expect(result.allowed).toBe(true);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between requests
      }

      // 6th request should be denied
      const deniedResult = await rateLimiter.checkLimit(testId, config);
      expect(deniedResult.allowed).toBe(false);

      // Wait for oldest request to slide out (2 seconds from first request)
      await new Promise(resolve => setTimeout(resolve, 1600));

      // Should allow one more request
      const allowedResult = await rateLimiter.checkLimit(testId, config);
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('5. Rate limit headers accuracy under load', () => {
    it('should maintain accurate headers during concurrent requests', async () => {
      const testIp = '192.168.1.200';
      const config = testConfigs.public;

      // Reset first
      await rateLimiter.reset(testIp, config);

      // Make 50 concurrent requests
      const requests = Array.from({ length: 50 }, () => 
        rateLimiter.checkLimit(testIp, config)
      );

      const results = await Promise.all(requests);

      // All results should have consistent limit
      results.forEach(result => {
        expect(result.limit).toBe(60);
      });

      // Sort results by remaining count
      const sortedResults = results.sort((a, b) => b.remaining - a.remaining);

      // Verify remaining counts are decreasing
      for (let i = 1; i < sortedResults.length; i++) {
        expect(sortedResults[i].remaining).toBeLessThanOrEqual(sortedResults[i-1].remaining);
      }

      // Verify reset time is consistent
      const resetTimes = results.map(r => r.resetAt.getTime());
      const uniqueResetTimes = [...new Set(resetTimes)];
      expect(uniqueResetTimes.length).toBeLessThanOrEqual(2); // Allow for minor timing differences
    });

    it('should show correct Retry-After header when rate limited', async () => {
      const testIp = '192.168.1.201';
      const config = testConfigs.public;

      // Exhaust the limit
      const requests = Array.from({ length: 60 }, () => 
        rateLimiter.checkLimit(testIp, config)
      );
      await Promise.all(requests);

      // Next request should be denied with Retry-After
      const deniedResult = await rateLimiter.checkLimit(testIp, config);
      expect(deniedResult.allowed).toBe(false);
      expect(deniedResult.retryAfter).toBeGreaterThan(0);
      expect(deniedResult.retryAfter).toBeLessThanOrEqual(60);
      expect(deniedResult.remaining).toBe(0);
    });
  });

  describe('6. Multiple IPs/users simultaneously', () => {
    it('should handle multiple IPs concurrently without interference', async () => {
      const config = testConfigs.public;
      const ips = Array.from({ length: 10 }, (_, i) => `192.168.1.${100 + i}`);

      // Each IP makes 65 requests (5 over limit)
      const allRequests = ips.flatMap(ip => 
        Array.from({ length: 65 }, () => ({
          ip,
          promise: rateLimiter.checkLimit(ip, config)
        }))
      );

      // Shuffle to simulate random concurrent access
      const shuffled = allRequests.sort(() => Math.random() - 0.5);
      
      const results = await Promise.all(shuffled.map(r => 
        r.promise.then(result => ({ ip: r.ip, result }))
      ));

      // Group results by IP
      const resultsByIp = results.reduce((acc, { ip, result }) => {
        if (!acc[ip]) acc[ip] = [];
        acc[ip].push(result);
        return acc;
      }, {} as Record<string, typeof results[0]['result'][]>);

      // Verify each IP has exactly 60 allowed and 5 denied
      Object.entries(resultsByIp).forEach(([ip, ipResults]) => {
        const allowed = ipResults.filter(r => r.allowed).length;
        const denied = ipResults.filter(r => !r.allowed).length;
        
        expect(allowed).toBe(60);
        expect(denied).toBe(5);
      });
    });

    it('should handle mixed authenticated and public users', async () => {
      const publicConfig = testConfigs.public;
      const authConfig = testConfigs.authenticated;

      // Create mixed requests
      const requests = [
        // Public users (IPs)
        ...Array.from({ length: 70 }, () => ({
          type: 'public',
          id: '192.168.1.150',
          promise: rateLimiter.checkLimit('192.168.1.150', publicConfig)
        })),
        // Authenticated users
        ...Array.from({ length: 130 }, () => ({
          type: 'auth',
          id: 'user-mixed-123',
          promise: rateLimiter.checkLimit('user-mixed-123', authConfig)
        }))
      ];

      // Shuffle and execute
      const shuffled = requests.sort(() => Math.random() - 0.5);
      const results = await Promise.all(shuffled.map(r => 
        r.promise.then(result => ({ ...r, result }))
      ));

      // Verify public user limits
      const publicResults = results.filter(r => r.type === 'public');
      const publicAllowed = publicResults.filter(r => r.result.allowed).length;
      const publicDenied = publicResults.filter(r => !r.result.allowed).length;
      expect(publicAllowed).toBe(60);
      expect(publicDenied).toBe(10);

      // Verify authenticated user limits
      const authResults = results.filter(r => r.type === 'auth');
      const authAllowed = authResults.filter(r => r.result.allowed).length;
      const authDenied = authResults.filter(r => !r.result.allowed).length;
      expect(authAllowed).toBe(120);
      expect(authDenied).toBe(10);
    });
  });

  describe('7. Reset behavior after window expires', () => {
    it('should reset counts after window expires', async () => {
      const testId = 'reset-test';
      const config = testConfigs.fastWindow; // 2 second window

      // Exhaust the limit
      const initialRequests = Array.from({ length: 5 }, () => 
        rateLimiter.checkLimit(testId, config)
      );
      await Promise.all(initialRequests);

      // Verify limit is reached
      const deniedResult = await rateLimiter.checkLimit(testId, config);
      expect(deniedResult.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Should be able to make requests again
      const newRequests = Array.from({ length: 5 }, () => 
        rateLimiter.checkLimit(testId, config)
      );
      const newResults = await Promise.all(newRequests);
      
      expect(newResults.every(r => r.allowed)).toBe(true);
      expect(newResults[0].remaining).toBe(4);
      expect(newResults[newResults.length - 1].remaining).toBe(0);
    });

    it('should handle manual reset correctly', async () => {
      const testId = 'manual-reset-test';
      const config = testConfigs.public;

      // Make some requests
      for (let i = 0; i < 30; i++) {
        await rateLimiter.checkLimit(testId, config);
      }

      // Check remaining
      let remaining = await rateLimiter.getRemainingRequests(testId, config);
      expect(remaining).toBe(30);

      // Manual reset
      const resetResult = await rateLimiter.reset(testId, config);
      expect(resetResult).toBe(true);

      // Should have full quota again
      remaining = await rateLimiter.getRemainingRequests(testId, config);
      expect(remaining).toBe(60);

      // Can make full quota of requests
      const requests = Array.from({ length: 60 }, () => 
        rateLimiter.checkLimit(testId, config)
      );
      const results = await Promise.all(requests);
      expect(results.every(r => r.allowed)).toBe(true);
    });
  });

  describe('Race condition prevention', () => {
    it('should handle rapid concurrent requests without race conditions', async () => {
      const testId = 'race-condition-test';
      const config = testConfigs.public;

      // Reset to ensure clean state
      await rateLimiter.reset(testId, config);

      // Create 100 concurrent requests (40 over limit)
      const requests = Array.from({ length: 100 }, () => 
        rateLimiter.checkLimit(testId, config)
      );

      const results = await Promise.all(requests);

      // Count results
      const allowed = results.filter(r => r.allowed).length;
      const denied = results.filter(r => !r.allowed).length;

      // Should be exactly 60 allowed and 40 denied (no double counting)
      expect(allowed).toBe(60);
      expect(denied).toBe(40);

      // Verify final state
      const finalRemaining = await rateLimiter.getRemainingRequests(testId, config);
      expect(finalRemaining).toBe(0);
    });

    it('should maintain consistency with interleaved operations', async () => {
      const testId = 'interleaved-test';
      const config = testConfigs.public;

      // Reset first
      await rateLimiter.reset(testId, config);

      // Interleave checkLimit and getRemainingRequests calls
      const operations = [];
      
      for (let i = 0; i < 30; i++) {
        operations.push(
          rateLimiter.checkLimit(testId, config),
          rateLimiter.getRemainingRequests(testId, config)
        );
      }

      const results = await Promise.all(operations);

      // Filter check results and remaining counts
      const checkResults = results.filter((_, i) => i % 2 === 0) as Awaited<ReturnType<typeof rateLimiter.checkLimit>>[];
      const remainingCounts = results.filter((_, i) => i % 2 === 1) as number[];

      // All check operations should succeed
      expect(checkResults.every(r => r.allowed)).toBe(true);

      // Remaining counts should be decreasing
      for (let i = 1; i < remainingCounts.length; i++) {
        expect(remainingCounts[i]).toBeLessThanOrEqual(remainingCounts[i-1]);
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle Redis unavailability gracefully', async () => {
      // Create a rate limiter instance without Redis
      const noRedisLimiter = new RateLimiter();
      
      // Force Redis to be null by accessing private property
      (noRedisLimiter as any).redis = null;

      const result = await noRedisLimiter.checkLimit('test-ip', testConfigs.public);
      
      // Should allow request when Redis is down
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(60);
      expect(result.remaining).toBe(60);
    });

    it('should handle very high concurrent load', async () => {
      const testId = 'high-load-test';
      const config = testConfigs.public;

      // Reset first
      await rateLimiter.reset(testId, config);

      // Create 1000 concurrent requests
      const requests = Array.from({ length: 1000 }, () => 
        rateLimiter.checkLimit(testId, config)
      );

      const results = await Promise.all(requests);

      const allowed = results.filter(r => r.allowed).length;
      const denied = results.filter(r => !r.allowed).length;

      // Should still maintain exact limit
      expect(allowed).toBe(60);
      expect(denied).toBe(940);
    });
  });
});

// Performance benchmarking test
describe('Rate Limiter Performance', () => {
  let rateLimiter: RateLimiter;

  beforeAll(() => {
    rateLimiter = new RateLimiter();
  });

  it('should handle high throughput efficiently', async () => {
    const config = testConfigs.public;
    const iterations = 1000;
    const concurrency = 100;

    const startTime = performance.now();

    // Run iterations in batches
    for (let i = 0; i < iterations / concurrency; i++) {
      const batch = Array.from({ length: concurrency }, (_, j) => 
        rateLimiter.checkLimit(`perf-test-${i}-${j}`, config)
      );
      await Promise.all(batch);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const requestsPerSecond = (iterations / totalTime) * 1000;

    console.log(`Performance: ${requestsPerSecond.toFixed(0)} requests/second`);
    console.log(`Average latency: ${(totalTime / iterations).toFixed(2)}ms per request`);

    // Should handle at least 1000 requests per second
    expect(requestsPerSecond).toBeGreaterThan(1000);
  });
});