import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { RedisClient, getRedisClient } from "./redis-client";
import { Redis } from "@upstash/redis";

// Mock the Redis module
mock.module("@upstash/redis", () => ({
  Redis: {
    fromEnv: mock(() => ({
      ping: mock(async () => "PONG"),
    })),
  },
}));

describe("RedisClient", () => {
  beforeEach(() => {
    // Reset the singleton state
    RedisClient.resetConnection();
    // Clear all mocks
    mock.restore();
  });

  afterEach(() => {
    RedisClient.resetConnection();
  });

  describe("getInstance", () => {
    test("should create a singleton instance", () => {
      const mockRedisInstance = { ping: mock(async () => "PONG") };
      const fromEnvMock = mock(() => mockRedisInstance);
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: fromEnvMock },
      }));

      const instance1 = RedisClient.getInstance();
      const instance2 = RedisClient.getInstance();

      expect(instance1).toBe(instance2);
      expect(fromEnvMock).toHaveBeenCalledTimes(1);
    });

    test("should handle connection failure gracefully", () => {
      const fromEnvMock = mock(() => {
        throw new Error("Connection failed");
      });

      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: fromEnvMock },
      }));

      const instance = RedisClient.getInstance();
      
      expect(instance).toBeNull();
      expect(fromEnvMock).toHaveBeenCalled();
    });

    test("should log successful connection", () => {
      const consoleSpy = mock(() => {});
      const originalLog = console.log;
      console.log = consoleSpy;

      const mockRedisInstance = { ping: mock(async () => "PONG") };
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      RedisClient.getInstance();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[Redis] Successfully connected to Upstash Redis"
      );

      console.log = originalLog;
    });

    test("should retry connection on failure", async () => {
      const fromEnvMock = mock(() => {
        throw new Error("Connection failed");
      });

      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: fromEnvMock },
      }));

      const setTimeoutSpy = mock((fn: Function, delay: number) => {
        // Don't actually execute the timeout
      });
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = setTimeoutSpy as any;

      RedisClient.getInstance();

      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(setTimeoutSpy.mock.calls[0][1]).toBeLessThanOrEqual(10000);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe("healthCheck", () => {
    test("should return true when Redis is healthy", async () => {
      const pingMock = mock(async () => "PONG");
      const mockRedisInstance = { ping: pingMock };
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      RedisClient.getInstance();
      const isHealthy = await RedisClient.healthCheck();

      expect(isHealthy).toBe(true);
      expect(pingMock).toHaveBeenCalled();
    });

    test("should return false when Redis is not connected", async () => {
      mock.module("@upstash/redis", () => ({
        Redis: {
          fromEnv: mock(() => {
            throw new Error("Connection failed");
          }),
        },
      }));

      const isHealthy = await RedisClient.healthCheck();
      expect(isHealthy).toBe(false);
    });

    test("should return false when ping fails", async () => {
      const pingMock = mock(async () => {
        throw new Error("Ping failed");
      });
      const mockRedisInstance = { ping: pingMock };
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      RedisClient.getInstance();
      const isHealthy = await RedisClient.healthCheck();

      expect(isHealthy).toBe(false);
    });

    test("should log error when health check fails", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      const error = new Error("Ping failed");
      const pingMock = mock(async () => {
        throw error;
      });
      const mockRedisInstance = { ping: pingMock };
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      RedisClient.getInstance();
      await RedisClient.healthCheck();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Redis] Health check failed:",
        error
      );

      console.error = originalError;
    });
  });

  describe("isHealthy", () => {
    test("should return true when connected", () => {
      const mockRedisInstance = { ping: mock(async () => "PONG") };
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      RedisClient.getInstance();
      expect(RedisClient.isHealthy()).toBe(true);
    });

    test("should return false when not connected", () => {
      mock.module("@upstash/redis", () => ({
        Redis: {
          fromEnv: mock(() => {
            throw new Error("Connection failed");
          }),
        },
      }));

      RedisClient.getInstance();
      expect(RedisClient.isHealthy()).toBe(false);
    });
  });

  describe("disconnect", () => {
    test("should reset instance and connection state", async () => {
      const mockRedisInstance = { ping: mock(async () => "PONG") };
      const fromEnvMock = mock(() => mockRedisInstance);
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: fromEnvMock },
      }));

      RedisClient.getInstance();
      expect(RedisClient.isHealthy()).toBe(true);
      expect(fromEnvMock).toHaveBeenCalledTimes(1);

      await RedisClient.disconnect();
      expect(RedisClient.isHealthy()).toBe(false);
      
      // After disconnect, getInstance should create a new connection
      const newInstance = RedisClient.getInstance();
      expect(newInstance).toBe(mockRedisInstance);
      expect(fromEnvMock).toHaveBeenCalledTimes(2); // Called again after disconnect
    });

    test("should log disconnect message", async () => {
      const consoleSpy = mock(() => {});
      const originalLog = console.log;
      console.log = consoleSpy;

      const mockRedisInstance = { ping: mock(async () => "PONG") };
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      RedisClient.getInstance();
      await RedisClient.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith("[Redis] Disconnected from Redis");

      console.log = originalLog;
    });

    test("should handle disconnect errors gracefully", async () => {
      const consoleErrorSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleErrorSpy;

      await RedisClient.disconnect();

      // Should not throw even when there's no instance
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      console.error = originalError;
    });
  });

  describe("resetConnection", () => {
    test("should reset all connection state", () => {
      const mockRedisInstance = { ping: mock(async () => "PONG") };
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      RedisClient.getInstance();
      expect(RedisClient.isHealthy()).toBe(true);

      RedisClient.resetConnection();
      expect(RedisClient.isHealthy()).toBe(false);
    });
  });

  describe("getRedisClient", () => {
    test("should return the Redis instance", () => {
      const mockRedisInstance = { ping: mock(async () => "PONG") };
      
      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: mock(() => mockRedisInstance) },
      }));

      const client = getRedisClient();
      expect(client).toBe(RedisClient.getInstance());
    });

    test("should return null when connection fails", () => {
      mock.module("@upstash/redis", () => ({
        Redis: {
          fromEnv: mock(() => {
            throw new Error("Connection failed");
          }),
        },
      }));

      const client = getRedisClient();
      expect(client).toBeNull();
    });
  });

  describe("retry mechanism", () => {
    test("should implement exponential backoff", () => {
      const fromEnvMock = mock(() => {
        throw new Error("Connection failed");
      });

      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: fromEnvMock },
      }));

      const delays: number[] = [];
      const setTimeoutSpy = mock((fn: Function, delay: number) => {
        delays.push(delay);
      });
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = setTimeoutSpy as any;

      // First attempt
      RedisClient.getInstance();
      
      // Check first delay
      expect(delays.length).toBe(1);
      expect(delays[0]).toBeLessThanOrEqual(2000); // First retry: max 2s

      global.setTimeout = originalSetTimeout;
    });

    test("should stop retrying after max attempts", () => {
      const fromEnvMock = mock(() => {
        throw new Error("Connection failed");
      });

      mock.module("@upstash/redis", () => ({
        Redis: { fromEnv: fromEnvMock },
      }));

      const setTimeoutSpy = mock(() => {});
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = setTimeoutSpy as any;

      // Simulate max retry attempts
      for (let i = 0; i < 4; i++) {
        RedisClient.getInstance();
      }

      // Should only retry 2 times (total 3 attempts)
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

      global.setTimeout = originalSetTimeout;
    });
  });
});