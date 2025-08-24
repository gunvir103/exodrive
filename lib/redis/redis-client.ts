import { Redis } from '@upstash/redis';

export class RedisClient {
  private static instance: Redis | null = null;
  private static connectionAttempts = 0;
  private static maxRetries = 3;
  private static isConnected = false;

  private constructor() {}

  static getInstance(): Redis | null {
    if (!this.instance) {
      // Check if Redis environment variables are properly configured
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      
      if (!redisUrl || !redisToken || 
          redisUrl === 'placeholder_redis_url' || 
          redisToken === 'placeholder_redis_token' ||
          !redisUrl.startsWith('https://')) {
        console.warn('[Redis] Redis not configured. Caching will be disabled.');
        return null;
      }
      
      try {
        this.instance = Redis.fromEnv();
        this.isConnected = true;
        this.connectionAttempts = 0;
        console.log('[Redis] Successfully connected to Upstash Redis');
      } catch (error) {
        console.error('[Redis] Failed to initialize Redis client:', error);
        this.isConnected = false;
        this.connectionAttempts++;
        
        if (this.connectionAttempts < this.maxRetries) {
          console.log(`[Redis] Retrying connection... (${this.connectionAttempts}/${this.maxRetries})`);
          setTimeout(() => this.getInstance(), Math.min(1000 * Math.pow(2, this.connectionAttempts), 10000));
        }
        
        return null;
      }
    }
    
    return this.instance;
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const client = this.getInstance();
      if (!client) return false;
      
      await client.ping();
      return true;
    } catch (error) {
      console.error('[Redis] Health check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  static isHealthy(): boolean {
    return this.isConnected;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      try {
        // Upstash Redis doesn't require explicit disconnect
        this.instance = null;
        this.isConnected = false;
        console.log('[Redis] Disconnected from Redis');
      } catch (error) {
        console.error('[Redis] Error during disconnect:', error);
      }
    }
  }

  static resetConnection(): void {
    this.instance = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
  }
}

// Export a convenience function to get the Redis instance
export function getRedisClient(): Redis | null {
  return RedisClient.getInstance();
}

// Export type for Redis instance
export type { Redis };