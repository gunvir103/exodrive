import { mock } from "bun:test";

// Mock Redis client
export const createMockRedisClient = () => {
  const store = new Map<string, any>();
  
  return {
    get: mock(async (key: string) => {
      const value = store.get(key);
      return value ? JSON.parse(value) : null;
    }),
    
    set: mock(async (key: string, value: any, options?: { ex?: number; nx?: boolean }) => {
      if (options?.nx && store.has(key)) {
        return null; // Key already exists
      }
      
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      store.set(key, serialized);
      
      if (options?.ex) {
        setTimeout(() => store.delete(key), options.ex * 1000);
      }
      
      return 'OK';
    }),
    
    del: mock(async (key: string) => {
      return store.delete(key) ? 1 : 0;
    }),
    
    exists: mock(async (key: string) => {
      return store.has(key) ? 1 : 0;
    }),
    
    expire: mock(async (key: string, seconds: number) => {
      if (store.has(key)) {
        setTimeout(() => store.delete(key), seconds * 1000);
        return 1;
      }
      return 0;
    }),
    
    ttl: mock(async (key: string) => {
      return store.has(key) ? 3600 : -2; // Return 1 hour for existing keys, -2 for non-existent
    }),
    
    scan: mock(async (cursor: number, options?: { match?: string; count?: number }) => {
      const keys = Array.from(store.keys());
      const matchedKeys = options?.match 
        ? keys.filter(key => key.includes(options.match!.replace('*', '')))
        : keys;
      
      return [0, matchedKeys]; // Simplified: always return cursor 0 (no pagination)
    }),
    
    pipeline: mock(() => {
      const commands: any[] = [];
      const pipelineObj = {
        get: mock((key: string) => {
          commands.push(['get', key]);
          return pipelineObj;
        }),
        set: mock((key: string, value: any, options?: any) => {
          commands.push(['set', key, value, options]);
          return pipelineObj;
        }),
        del: mock((key: string) => {
          commands.push(['del', key]);
          return pipelineObj;
        }),
        expire: mock((key: string, seconds: number) => {
          commands.push(['expire', key, seconds]);
          return pipelineObj;
        }),
        exec: mock(async () => {
          const results = [];
          for (const [cmd, ...args] of commands) {
            switch (cmd) {
              case 'get':
                results.push(store.get(args[0]) || null);
                break;
              case 'set':
                store.set(args[0], args[1]);
                results.push('OK');
                break;
              case 'del':
                results.push(store.delete(args[0]) ? 1 : 0);
                break;
              case 'expire':
                results.push(1);
                break;
            }
          }
          return results;
        }),
      };
      return pipelineObj;
    }),
    
    // Helper methods for testing
    _store: store,
    _clear: () => store.clear(),
    _has: (key: string) => store.has(key),
    _getAll: () => Object.fromEntries(store),
  };
};

// Mock Redis from Upstash
export const mockRedisFromEnv = mock(() => createMockRedisClient());

// Mock cache service
export const createMockCacheService = () => {
  const redisClient = createMockRedisClient();
  
  return {
    get: mock(async (key: string) => {
      const value = await redisClient.get(key);
      return value;
    }),
    
    set: mock(async (key: string, value: any, ttl?: number) => {
      await redisClient.set(key, value, ttl ? { ex: ttl } : undefined);
      return true;
    }),
    
    delete: mock(async (key: string) => {
      await redisClient.del(key);
      return true;
    }),
    
    flush: mock(async () => {
      redisClient._clear();
      return true;
    }),
    
    generateCacheKey: mock((...parts: string[]) => {
      return parts.filter(Boolean).join(':');
    }),
    
    invalidatePattern: mock(async (pattern: string) => {
      const keys = Array.from(redisClient._store.keys());
      const matchedKeys = keys.filter(key => key.includes(pattern.replace('*', '')));
      
      for (const key of matchedKeys) {
        await redisClient.del(key);
      }
      
      return matchedKeys.length;
    }),
  };
};

// Mock cache invalidation
export const mockInvalidateCacheByEvent = mock(async (event: string) => {
  console.log(`[Mock] Cache invalidated for event: ${event}`);
  return true;
});