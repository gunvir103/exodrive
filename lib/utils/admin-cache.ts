/**
 * Admin Status Cache
 * Caches admin status checks to reduce database queries
 */

import { AUTH_CONFIG } from '@/lib/config/auth.config';
import { logger } from './logger';

interface CacheEntry {
  isAdmin: boolean;
  timestamp: number;
  metadata?: any;
}

class AdminStatusCache {
  private cache: Map<string, CacheEntry>;
  private ttl: number;
  private maxSize: number;
  private logger = logger.child('AdminCache');

  constructor(ttl?: number, maxSize: number = 100) {
    this.cache = new Map();
    this.ttl = ttl || AUTH_CONFIG.CACHE.ADMIN_STATUS_TTL;
    this.maxSize = maxSize;
  }

  /**
   * Get cached admin status
   */
  get(userId: string): boolean | null {
    const entry = this.cache.get(userId);
    
    if (!entry) {
      this.logger.debug('Cache miss', { userId });
      return null;
    }
    
    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.logger.debug('Cache expired', { userId, age: now - entry.timestamp });
      this.cache.delete(userId);
      return null;
    }
    
    this.logger.debug('Cache hit', { userId, isAdmin: entry.isAdmin });
    return entry.isAdmin;
  }

  /**
   * Set admin status in cache
   */
  set(userId: string, isAdmin: boolean, metadata?: any): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.logger.debug('Evicted oldest entry', { userId: firstKey });
      }
    }
    
    this.cache.set(userId, {
      isAdmin,
      timestamp: Date.now(),
      metadata,
    });
    
    this.logger.debug('Cache set', { userId, isAdmin });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(userId: string): void {
    const deleted = this.cache.delete(userId);
    if (deleted) {
      this.logger.debug('Cache invalidated', { userId });
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info('Cache cleared', { entriesCleared: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
    entries: Array<{ userId: string; isAdmin: boolean; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([userId, entry]) => ({
      userId,
      isAdmin: entry.isAdmin,
      age: now - entry.timestamp,
    }));
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      entries,
    };
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    
    for (const [userId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(userId);
        pruned++;
      }
    }
    
    if (pruned > 0) {
      this.logger.debug('Pruned expired entries', { count: pruned });
    }
    
    return pruned;
  }

  /**
   * Check if user is in cache (regardless of expiry)
   */
  has(userId: string): boolean {
    return this.cache.has(userId);
  }

  /**
   * Get cache entry with metadata
   */
  getEntry(userId: string): CacheEntry | null {
    const entry = this.cache.get(userId);
    
    if (!entry) return null;
    
    // Check expiry
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(userId);
      return null;
    }
    
    return entry;
  }

  /**
   * Batch get multiple users
   */
  getMany(userIds: string[]): Map<string, boolean | null> {
    const results = new Map<string, boolean | null>();
    
    for (const userId of userIds) {
      results.set(userId, this.get(userId));
    }
    
    return results;
  }

  /**
   * Batch set multiple users
   */
  setMany(entries: Array<{ userId: string; isAdmin: boolean; metadata?: any }>): void {
    for (const entry of entries) {
      this.set(entry.userId, entry.isAdmin, entry.metadata);
    }
  }
}

// Export singleton instance with default configuration
export const adminCache = new AdminStatusCache();

// Export class for custom instances
export { AdminStatusCache };

// Export types
export type { CacheEntry };