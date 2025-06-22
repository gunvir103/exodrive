import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { CacheService, cacheService, getCachedData, invalidateCacheByEvent, cacheConfigs } from "./cache-service";
import * as RedisClientModule from "./redis-client";

describe("CacheService", () => {
  let service: CacheService;
  let mockRedis: any;

  beforeEach(() => {
    // Create a mock Redis client
    mockRedis = {
      get: mock(async () => null),
      set: mock(async () => "OK"),
      setex: mock(async () => "OK"),
      del: mock(async () => 1),
      scan: mock(async () => [0, []]),
      exists: mock(async () => 1),
      ttl: mock(async () => 300),
      flushdb: mock(async () => "OK"),
    };

    // Mock the getRedisClient function
    mock.module("./redis-client", () => ({
      getRedisClient: mock(() => mockRedis),
    }));

    service = new CacheService();
  });

  afterEach(() => {
    mock.restore();
  });

  describe("get", () => {
    test("should return cached data when available", async () => {
      const testData = { id: 1, name: "Test Car" };
      mockRedis.get.mockImplementation(async () => testData);

      const result = await service.get<typeof testData>("test-key");

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith("test-key");
    });

    test("should return null when key does not exist", async () => {
      mockRedis.get.mockImplementation(async () => null);

      const result = await service.get("non-existent-key");

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith("non-existent-key");
    });

    test("should return null when Redis is not available", async () => {
      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = await serviceWithoutRedis.get("test-key");

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Cache] Redis client not available, falling back to no cache"
      );

      console.warn = originalWarn;
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.get.mockImplementation(async () => {
        throw error;
      });

      const result = await service.get("test-key");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Cache] Error getting cache:",
        error
      );

      console.error = originalError;
    });
  });

  describe("set", () => {
    test("should set value without TTL", async () => {
      const testData = { id: 1, name: "Test" };

      const result = await service.set("test-key", testData);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith("test-key", testData);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    test("should set value with TTL", async () => {
      const testData = { id: 1, name: "Test" };
      const ttl = 300;

      const result = await service.set("test-key", testData, ttl);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith("test-key", ttl, testData);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    test("should handle zero TTL", async () => {
      const testData = { id: 1, name: "Test" };

      const result = await service.set("test-key", testData, 0);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith("test-key", testData);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    test("should return false when Redis is not available", async () => {
      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = await serviceWithoutRedis.set("test-key", "value");

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Cache] Redis client not available, skipping cache set"
      );

      console.warn = originalWarn;
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.set.mockImplementation(async () => {
        throw error;
      });

      const result = await service.set("test-key", "value");

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Cache] Error setting cache:",
        error
      );

      console.error = originalError;
    });
  });

  describe("delete", () => {
    test("should delete existing key", async () => {
      mockRedis.del.mockImplementation(async () => 1);

      const result = await service.delete("test-key");

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith("test-key");
    });

    test("should return false for non-existent key", async () => {
      mockRedis.del.mockImplementation(async () => 0);

      const result = await service.delete("non-existent-key");

      expect(result).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith("non-existent-key");
    });

    test("should return false when Redis is not available", async () => {
      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = await serviceWithoutRedis.delete("test-key");

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Cache] Redis client not available, skipping cache delete"
      );

      console.warn = originalWarn;
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.del.mockImplementation(async () => {
        throw error;
      });

      const result = await service.delete("test-key");

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Cache] Error deleting cache:",
        error
      );

      console.error = originalError;
    });
  });

  describe("invalidate", () => {
    test("should invalidate keys matching pattern", async () => {
      const consoleLogSpy = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLogSpy;

      const matchingKeys = ["cache:user:1", "cache:user:2"];
      mockRedis.scan.mockImplementation(async () => [0, matchingKeys]);
      mockRedis.del.mockImplementation(async () => matchingKeys.length);

      const result = await service.invalidate("cache:user:*");

      expect(result).toBe(2);
      expect(mockRedis.scan).toHaveBeenCalledWith(0, {
        match: "cache:user:*",
        count: 100,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Cache] Invalidated 2 keys matching pattern: cache:user:*"
      );

      console.log = originalLog;
    });

    test("should handle multiple scan iterations", async () => {
      const keys1 = ["key1", "key2"];
      const keys2 = ["key3", "key4"];
      let scanCallCount = 0;

      mockRedis.scan.mockImplementation(async (cursor: number) => {
        scanCallCount++;
        if (cursor === 0) {
          return [100, keys1];
        } else {
          return [0, keys2];
        }
      });
      mockRedis.del.mockImplementation(async () => 4);

      const result = await service.invalidate("pattern:*");

      expect(result).toBe(4);
      expect(scanCallCount).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith(...keys1, ...keys2);
    });

    test("should return 0 when no keys match", async () => {
      mockRedis.scan.mockImplementation(async () => [0, []]);

      const result = await service.invalidate("no-match:*");

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    test("should return 0 when Redis is not available", async () => {
      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = await serviceWithoutRedis.invalidate("pattern:*");

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Cache] Redis client not available, skipping cache invalidation"
      );

      console.warn = originalWarn;
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.scan.mockImplementation(async () => {
        throw error;
      });

      const result = await service.invalidate("pattern:*");

      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Cache] Error invalidating cache:",
        error
      );

      console.error = originalError;
    });
  });

  describe("invalidateByTags", () => {
    test("should invalidate multiple tag patterns", async () => {
      const tags = ["user", "product", "order"];
      mockRedis.scan.mockImplementation(async () => [0, ["key1", "key2"]]);
      mockRedis.del.mockImplementation(async () => 2);

      const result = await service.invalidateByTags(tags);

      expect(result).toBe(6); // 2 keys deleted for each of 3 tags
      expect(mockRedis.scan).toHaveBeenCalledTimes(3);
      expect(mockRedis.scan).toHaveBeenCalledWith(0, {
        match: "*:user:*",
        count: 100,
      });
      expect(mockRedis.scan).toHaveBeenCalledWith(0, {
        match: "*:product:*",
        count: 100,
      });
      expect(mockRedis.scan).toHaveBeenCalledWith(0, {
        match: "*:order:*",
        count: 100,
      });
    });

    test("should handle empty tags array", async () => {
      const result = await service.invalidateByTags([]);

      expect(result).toBe(0);
      expect(mockRedis.scan).not.toHaveBeenCalled();
    });
  });

  describe("exists", () => {
    test("should return true when key exists", async () => {
      mockRedis.exists.mockImplementation(async () => 1);

      const result = await service.exists("test-key");

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith("test-key");
    });

    test("should return false when key does not exist", async () => {
      mockRedis.exists.mockImplementation(async () => 0);

      const result = await service.exists("non-existent-key");

      expect(result).toBe(false);
    });

    test("should return false when Redis is not available", async () => {
      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = await serviceWithoutRedis.exists("test-key");

      expect(result).toBe(false);
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.exists.mockImplementation(async () => {
        throw error;
      });

      const result = await service.exists("test-key");

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Cache] Error checking existence:",
        error
      );

      console.error = originalError;
    });
  });

  describe("ttl", () => {
    test("should return TTL for existing key", async () => {
      mockRedis.ttl.mockImplementation(async () => 300);

      const result = await service.ttl("test-key");

      expect(result).toBe(300);
      expect(mockRedis.ttl).toHaveBeenCalledWith("test-key");
    });

    test("should return -1 for non-existent key", async () => {
      mockRedis.ttl.mockImplementation(async () => -2);

      const result = await service.ttl("non-existent-key");

      expect(result).toBe(-2);
    });

    test("should return -1 when Redis is not available", async () => {
      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = await serviceWithoutRedis.ttl("test-key");

      expect(result).toBe(-1);
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.ttl.mockImplementation(async () => {
        throw error;
      });

      const result = await service.ttl("test-key");

      expect(result).toBe(-1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Cache] Error getting TTL:",
        error
      );

      console.error = originalError;
    });
  });

  describe("flush", () => {
    test("should flush the database", async () => {
      const consoleLogSpy = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLogSpy;

      const result = await service.flush();

      expect(result).toBe(true);
      expect(mockRedis.flushdb).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Cache] Cache flushed successfully"
      );

      console.log = originalLog;
    });

    test("should return false when Redis is not available", async () => {
      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = await serviceWithoutRedis.flush();

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Cache] Redis client not available, skipping flush"
      );

      console.warn = originalWarn;
    });

    test("should handle errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Redis error");
      mockRedis.flushdb.mockImplementation(async () => {
        throw error;
      });

      const result = await service.flush();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Cache] Error flushing cache:",
        error
      );

      console.error = originalError;
    });
  });

  describe("generateCacheKey", () => {
    test("should generate cache key with multiple parts", () => {
      const key = service.generateCacheKey("user:", "123", "profile");

      expect(key).toBe("user:123:profile");
    });

    test("should handle numeric parts", () => {
      const key = service.generateCacheKey("item:", 456, "details", 789);

      expect(key).toBe("item:456:details:789");
    });

    test("should handle single part", () => {
      const key = service.generateCacheKey("prefix:", "suffix");

      expect(key).toBe("prefix:suffix");
    });

    test("should handle empty parts array", () => {
      const key = service.generateCacheKey("prefix:");

      expect(key).toBe("prefix:");
    });
  });

  describe("isAvailable", () => {
    test("should return true when Redis is available", () => {
      const result = service.isAvailable();

      expect(result).toBe(true);
    });

    test("should return false when Redis is not available", () => {
      mock.module("./redis-client", () => ({
        getRedisClient: mock(() => null),
      }));

      const serviceWithoutRedis = new CacheService();
      const result = serviceWithoutRedis.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe("singleton instance", () => {
    test("cacheService should be a CacheService instance", () => {
      expect(cacheService).toBeInstanceOf(CacheService);
    });
  });

  describe("getCachedData helper", () => {
    test("should return cached data when available", async () => {
      const cachedData = { id: 1, name: "Cached" };
      mockRedis.get.mockImplementation(async () => cachedData);

      // Mock the cacheService methods directly
      const originalGet = cacheService.get;
      const originalSet = cacheService.set;
      cacheService.get = mock(async () => cachedData);
      cacheService.set = mock(async () => true);

      const fetcher = mock(async () => ({ id: 1, name: "Fresh" }));

      const result = await getCachedData("test-key", fetcher);

      expect(result).toEqual(cachedData);
      expect(fetcher).not.toHaveBeenCalled();

      // Restore
      cacheService.get = originalGet;
      cacheService.set = originalSet;
    });

    test("should fetch and cache data when not cached", async () => {
      const freshData = { id: 1, name: "Fresh" };
      mockRedis.get.mockImplementation(async () => null);

      // Mock the cacheService methods directly
      const originalGet = cacheService.get;
      const originalSet = cacheService.set;
      cacheService.get = mock(async () => null);
      cacheService.set = mock(async () => true);

      const fetcher = mock(async () => freshData);

      const result = await getCachedData("test-key", fetcher, 600);

      expect(result).toEqual(freshData);
      expect(fetcher).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith("test-key", freshData, 600);

      // Restore
      cacheService.get = originalGet;
      cacheService.set = originalSet;
    });

    test("should use default TTL when not specified", async () => {
      mockRedis.get.mockImplementation(async () => null);

      // Mock the cacheService methods directly
      const originalGet = cacheService.get;
      const originalSet = cacheService.set;
      cacheService.get = mock(async () => null);
      cacheService.set = mock(async () => true);

      const fetcher = mock(async () => ({ data: "test" }));

      await getCachedData("test-key", fetcher);

      expect(cacheService.set).toHaveBeenCalledWith("test-key", { data: "test" }, 300);

      // Restore
      cacheService.get = originalGet;
      cacheService.set = originalSet;
    });
  });

  describe("invalidateCacheByEvent helper", () => {
    test("should invalidate caches based on event", async () => {
      mockRedis.scan.mockImplementation(async () => [0, ["key1", "key2"]]);
      mockRedis.del.mockImplementation(async () => 2);

      // Mock the cacheService invalidate method
      const originalInvalidate = cacheService.invalidate;
      cacheService.invalidate = mock(async () => 2);

      await invalidateCacheByEvent("booking.created");

      // Should invalidate carAvailability cache which has this event
      expect(cacheService.invalidate).toHaveBeenCalledWith("availability:*");

      // Restore
      cacheService.invalidate = originalInvalidate;
    });

    test("should invalidate multiple cache configs for same event", async () => {
      mockRedis.scan.mockImplementation(async () => [0, []]);

      // Mock the cacheService invalidate method
      const originalInvalidate = cacheService.invalidate;
      cacheService.invalidate = mock(async () => 0);

      await invalidateCacheByEvent("car.updated");

      // Should invalidate both fleetListing and carDetails caches
      expect(cacheService.invalidate).toHaveBeenCalledTimes(2);
      expect(cacheService.invalidate).toHaveBeenCalledWith("fleet:*");
      expect(cacheService.invalidate).toHaveBeenCalledWith("car:*");

      // Restore
      cacheService.invalidate = originalInvalidate;
    });

    test("should not invalidate when event doesn't match any config", async () => {
      // Mock the cacheService invalidate method
      const originalInvalidate = cacheService.invalidate;
      cacheService.invalidate = mock(async () => 0);

      await invalidateCacheByEvent("unknown.event");

      expect(cacheService.invalidate).not.toHaveBeenCalled();

      // Restore
      cacheService.invalidate = originalInvalidate;
    });
  });

  describe("cacheConfigs", () => {
    test("should have proper configuration for carAvailability", () => {
      expect(cacheConfigs.carAvailability).toEqual({
        ttl: 300,
        keyPrefix: "availability:",
        invalidationEvents: ["booking.created", "booking.cancelled"],
      });
    });

    test("should have proper configuration for fleetListing", () => {
      expect(cacheConfigs.fleetListing).toEqual({
        ttl: 3600,
        keyPrefix: "fleet:",
        invalidationEvents: ["car.updated", "car.created", "car.deleted"],
      });
    });

    test("should have proper configuration for carDetails", () => {
      expect(cacheConfigs.carDetails).toEqual({
        ttl: 1800,
        keyPrefix: "car:",
        invalidationEvents: ["car.updated"],
      });
    });
  });
});