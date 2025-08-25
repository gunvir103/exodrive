import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { RateLimiter, rateLimiter, rateLimitConfigs } from "./rate-limiter";
import type { RateLimitConfig, RateLimitResult } from "./rate-limiter";

describe("RateLimiter", () => {
  let service: RateLimiter;
  let mockRedis: any;
  let originalDateNow: () => number;
  let currentTime: number;

  beforeEach(() => {
    // Mock Date.now() for consistent testing
    currentTime = 1000000000000; // Fixed timestamp
    originalDateNow = Date.now;
    Date.now = () => currentTime;

    // Create a mock Redis client
    mockRedis = {
      pipeline: mock(() => ({
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 5, null]), // Default: 5 requests in window
      })),
      zrange: mock(async () => []),
      del: mock(async () => 1),
      zremrangebyscore: mock(async () => 0),
      zcard: mock(async () => 0),
    };

    // Mock the getRedisClient function
    mock.module("../redis/redis-client", () => ({
      getRedisClient: mock(() => mockRedis),
    }));

    service = new RateLimiter();
  });

  afterEach(() => {
    Date.now = originalDateNow;
    mock.restore();
  });

  describe("checkLimit", () => {
    const testConfig: RateLimitConfig = {
      windowMs: 60000, // 1 minute
      max: 10,
      keyGenerator: (id: string) => `test:${id}`,
    };

    test("should allow request when under limit", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 5, null]), // 5 requests in window
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      const result = await service.checkLimit("user123", testConfig);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(5); // 10 - 5 = 5
      expect(result.resetAt.getTime()).toBe(currentTime + testConfig.windowMs);
      expect(result.retryAfter).toBeNull();

      // Verify pipeline operations
      expect(pipeline.zremrangebyscore).toHaveBeenCalledWith(
        "test:user123",
        "-inf",
        (currentTime - testConfig.windowMs).toString()
      );
      expect(pipeline.zadd).toHaveBeenCalledWith(
        "test:user123",
        expect.objectContaining({
          score: currentTime,
          member: expect.stringContaining(`${currentTime}-`),
        })
      );
      expect(pipeline.zcard).toHaveBeenCalledWith("test:user123");
      expect(pipeline.expire).toHaveBeenCalledWith("test:user123", 60);
    });

    test("should deny request when at limit", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 11, null]), // 11 requests (over limit of 10)
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      // Mock zrange for calculating retry after
      const oldestTimestamp = currentTime - 30000; // 30 seconds ago
      mockRedis.zrange.mockImplementation(async () => ["request1", oldestTimestamp]);

      const result = await service.checkLimit("user123", testConfig);

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(30); // 30 seconds until oldest expires

      // Verify zrange was called to get oldest request
      expect(mockRedis.zrange).toHaveBeenCalledWith("test:user123", 0, 0, {
        withScores: true,
      });
    });

    test("should handle empty zrange result when calculating retry", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 11, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);
      mockRedis.zrange.mockImplementation(async () => []); // Empty result

      const result = await service.checkLimit("user123", testConfig);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(60); // Default to window size in seconds
    });

    test("should handle Redis unavailable gracefully", async () => {
      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      mock.module("../redis/redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new RateLimiter();
      const result = await serviceWithoutRedis.checkLimit("user123", testConfig);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(10);
      expect(result.retryAfter).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[RateLimiter] Redis not available, allowing request"
      );

      console.warn = originalWarn;
    });

    test("should handle Redis errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.pipeline.mockImplementation(() => {
        throw error;
      });

      const result = await service.checkLimit("user123", testConfig);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(10);
      expect(result.retryAfter).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[RateLimiter] Error checking rate limit:",
        error
      );

      console.error = originalError;
    });

    test("should handle exactly at limit correctly", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 10, null]), // Exactly at limit
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      const result = await service.checkLimit("user123", testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    test("should calculate correct expiration time", async () => {
      const customConfig: RateLimitConfig = {
        windowMs: 3600000, // 1 hour
        max: 100,
        keyGenerator: (id: string) => `hourly:${id}`,
      };

      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 50, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      await service.checkLimit("user123", customConfig);

      expect(pipeline.expire).toHaveBeenCalledWith("hourly:user123", 3600); // 1 hour in seconds
    });

    test("should handle sliding window correctly", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 3, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      const windowStart = currentTime - testConfig.windowMs;

      await service.checkLimit("user123", testConfig);

      expect(pipeline.zremrangebyscore).toHaveBeenCalledWith(
        "test:user123",
        "-inf",
        windowStart.toString()
      );
    });

    test("should generate unique request IDs", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 1, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      await service.checkLimit("user123", testConfig);
      await service.checkLimit("user123", testConfig);

      const calls = pipeline.zadd.mock.calls;
      expect(calls.length).toBe(2);
      
      const member1 = calls[0][1].member;
      const member2 = calls[1][1].member;
      
      expect(member1).not.toBe(member2); // Should be unique
      expect(member1).toContain(`${currentTime}-`);
      expect(member2).toContain(`${currentTime}-`);
    });
  });

  describe("reset", () => {
    const testConfig: RateLimitConfig = {
      windowMs: 60000,
      max: 10,
      keyGenerator: (id: string) => `test:${id}`,
    };

    test("should reset rate limit for identifier", async () => {
      mockRedis.del.mockImplementation(async () => 1);

      const result = await service.reset("user123", testConfig);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith("test:user123");
    });

    test("should return false when Redis is not available", async () => {
      mock.module("../redis/redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new RateLimiter();
      const result = await serviceWithoutRedis.reset("user123", testConfig);

      expect(result).toBe(false);
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.del.mockImplementation(async () => {
        throw error;
      });

      const result = await service.reset("user123", testConfig);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[RateLimiter] Error resetting rate limit:",
        error
      );

      console.error = originalError;
    });
  });

  describe("getRemainingRequests", () => {
    const testConfig: RateLimitConfig = {
      windowMs: 60000,
      max: 10,
      keyGenerator: (id: string) => `test:${id}`,
    };

    test("should return remaining requests", async () => {
      mockRedis.zremrangebyscore.mockImplementation(async () => 0);
      mockRedis.zcard.mockImplementation(async () => 7);

      const remaining = await service.getRemainingRequests("user123", testConfig);

      expect(remaining).toBe(3); // 10 - 7 = 3
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        "test:user123",
        "-inf",
        (currentTime - testConfig.windowMs).toString()
      );
      expect(mockRedis.zcard).toHaveBeenCalledWith("test:user123");
    });

    test("should return 0 when over limit", async () => {
      mockRedis.zremrangebyscore.mockImplementation(async () => 0);
      mockRedis.zcard.mockImplementation(async () => 15);

      const remaining = await service.getRemainingRequests("user123", testConfig);

      expect(remaining).toBe(0);
    });

    test("should return max when Redis is not available", async () => {
      mock.module("../redis/redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new RateLimiter();
      const remaining = await serviceWithoutRedis.getRemainingRequests("user123", testConfig);

      expect(remaining).toBe(10);
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.zremrangebyscore.mockImplementation(async () => {
        throw error;
      });

      const remaining = await service.getRemainingRequests("user123", testConfig);

      expect(remaining).toBe(10);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[RateLimiter] Error getting remaining requests:",
        error
      );

      console.error = originalError;
    });
  });

  describe("isAvailable", () => {
    test("should return true when Redis is available", () => {
      const result = service.isAvailable();
      expect(result).toBe(true);
    });

    test("should return false when Redis is not available", () => {
      mock.module("../redis/redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new RateLimiter();
      const result = serviceWithoutRedis.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe("rateLimitConfigs", () => {
    test("should have correct public config", () => {
      expect(rateLimitConfigs.public).toEqual({
        windowMs: 60000,
        max: 60,
        keyGenerator: expect.any(Function),
      });
      expect(rateLimitConfigs.public.keyGenerator("192.168.1.1")).toBe("rate:public:192.168.1.1");
    });

    test("should have correct authenticated config", () => {
      expect(rateLimitConfigs.authenticated).toEqual({
        windowMs: 60000,
        max: 120,
        keyGenerator: expect.any(Function),
      });
      expect(rateLimitConfigs.authenticated.keyGenerator("user123")).toBe("rate:auth:user123");
    });

    test("should have correct booking config", () => {
      expect(rateLimitConfigs.booking).toEqual({
        windowMs: 3600000,
        max: 10,
        keyGenerator: expect.any(Function),
      });
      expect(rateLimitConfigs.booking.keyGenerator("user123")).toBe("rate:booking:user123");
    });
  });

  describe("singleton instance", () => {
    test("rateLimiter should be a RateLimiter instance", () => {
      expect(rateLimiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe("edge cases", () => {
    const testConfig: RateLimitConfig = {
      windowMs: 60000,
      max: 10,
      keyGenerator: (id: string) => `test:${id}`,
    };

    test("should handle very small window", async () => {
      const smallWindowConfig: RateLimitConfig = {
        windowMs: 1000, // 1 second
        max: 5,
        keyGenerator: (id: string) => `fast:${id}`,
      };

      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 3, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      await service.checkLimit("user123", smallWindowConfig);

      expect(pipeline.expire).toHaveBeenCalledWith("fast:user123", 1);
    });

    test("should handle very large window", async () => {
      const largeWindowConfig: RateLimitConfig = {
        windowMs: 86400000, // 24 hours
        max: 1000,
        keyGenerator: (id: string) => `daily:${id}`,
      };

      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 500, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      const result = await service.checkLimit("user123", largeWindowConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(500);
      expect(pipeline.expire).toHaveBeenCalledWith("daily:user123", 86400);
    });

    test("should handle concurrent requests correctly", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 8, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      // Simulate concurrent requests
      const promises = Array(5).fill(null).map(() => 
        service.checkLimit("user123", testConfig)
      );

      const results = await Promise.all(promises);

      // All should succeed as we're under the limit
      results.forEach(result => {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // 10 - 8 = 2
      });

      // Should have been called 5 times
      expect(mockRedis.pipeline).toHaveBeenCalledTimes(5);
    });

    test("should handle special characters in identifiers", async () => {
      const specialConfig: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        keyGenerator: (id: string) => `special:${id}`,
      };

      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 1, null]),
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      const specialId = "user@example.com:with:colons";
      await service.checkLimit(specialId, specialConfig);

      expect(pipeline.zadd).toHaveBeenCalledWith(
        `special:${specialId}`,
        expect.any(Object)
      );
    });

    test("should calculate retry after correctly when far over limit", async () => {
      const pipeline = {
        zremrangebyscore: mock(() => {}),
        zadd: mock(() => {}),
        zcard: mock(() => {}),
        expire: mock(() => {}),
        exec: mock(async () => [null, null, 20, null]), // Way over limit
      };
      mockRedis.pipeline.mockImplementation(() => pipeline);

      // Mock oldest request from 50 seconds ago
      const oldestTimestamp = currentTime - 50000;
      mockRedis.zrange.mockImplementation(async () => ["request1", oldestTimestamp]);

      const result = await service.checkLimit("user123", testConfig);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(10); // 60 - 50 = 10 seconds
    });
  });
});