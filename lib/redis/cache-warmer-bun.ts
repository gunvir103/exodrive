/**
 * Bun-optimized cache warming utilities
 * This module provides additional utilities specifically optimized for Bun runtime
 */

import { cacheService } from './cache-service';
import type { CacheWarmingMetrics } from './cache-warmer';

export interface BunWarmingTask {
  name: string;
  execute: () => Promise<void>;
  priority?: number;
}

export class BunCacheWarmer {
  private tasks: BunWarmingTask[] = [];
  private metrics: Map<string, number> = new Map();

  /**
   * Add a warming task
   */
  addTask(task: BunWarmingTask): void {
    this.tasks.push(task);
  }

  /**
   * Execute all tasks with Bun-optimized concurrency
   */
  async executeTasks(maxConcurrency: number = 10): Promise<CacheWarmingMetrics> {
    const startTime = Bun.nanoseconds();
    const errors: string[] = [];
    let keysWarmed = 0;

    // Sort tasks by priority (higher priority first)
    const sortedTasks = [...this.tasks].sort((a, b) => 
      (b.priority ?? 0) - (a.priority ?? 0)
    );

    // Create a semaphore for concurrency control
    const running = new Set<Promise<void>>();
    
    for (const task of sortedTasks) {
      // Wait if we're at max concurrency
      if (running.size >= maxConcurrency) {
        await Promise.race(running);
      }

      const taskPromise = this.executeTask(task)
        .then(() => {
          keysWarmed++;
          running.delete(taskPromise);
        })
        .catch(error => {
          errors.push(`Task ${task.name}: ${error.message}`);
          running.delete(taskPromise);
        });

      running.add(taskPromise);
    }

    // Wait for all remaining tasks
    await Promise.all(running);

    const endTime = Bun.nanoseconds();
    const duration = Math.round((endTime - startTime) / 1_000_000);

    return {
      startTime: new Date(),
      endTime: new Date(),
      duration,
      keysWarmed,
      errors,
      status: errors.length === 0 ? 'success' : keysWarmed > 0 ? 'partial' : 'failed'
    };
  }

  /**
   * Execute a single task with timing
   */
  private async executeTask(task: BunWarmingTask): Promise<void> {
    const taskStart = Bun.nanoseconds();
    
    try {
      await task.execute();
      
      const taskDuration = (Bun.nanoseconds() - taskStart) / 1_000_000;
      this.metrics.set(task.name, taskDuration);
      
      console.log(`[BunCacheWarmer] Task '${task.name}' completed in ${taskDuration.toFixed(2)}ms`);
    } catch (error) {
      const taskDuration = (Bun.nanoseconds() - taskStart) / 1_000_000;
      this.metrics.set(task.name, taskDuration);
      
      console.error(`[BunCacheWarmer] Task '${task.name}' failed after ${taskDuration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Get task execution metrics
   */
  getTaskMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }

  /**
   * Clear all tasks
   */
  clearTasks(): void {
    this.tasks = [];
    this.metrics.clear();
  }

  /**
   * Batch warm multiple cache keys
   */
  static async batchWarmKeys(
    keys: Array<{ key: string; fetcher: () => Promise<any>; ttl: number }>,
    batchSize: number = 10
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async ({ key, fetcher, ttl }) => {
          try {
            const data = await fetcher();
            await cacheService.set(key, data, ttl);
            return true;
          } catch (error) {
            console.error(`[BunCacheWarmer] Failed to warm key ${key}:`, error);
            return false;
          }
        })
      );

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          succeeded++;
        } else {
          failed++;
        }
      });
    }

    return { succeeded, failed };
  }

  /**
   * Create a background warming process using Bun.spawn
   */
  static spawnWarmingProcess(scriptPath: string, args: string[] = []): void {
    const proc = Bun.spawn({
      cmd: ["bun", "run", scriptPath, ...args],
      stdout: "inherit",
      stderr: "inherit",
      stdin: "ignore",
      env: {
        ...process.env,
        CACHE_WARMING_PROCESS: "true"
      }
    });

    console.log(`[BunCacheWarmer] Spawned background warming process with PID: ${proc.pid}`);
    
    // Don't wait for the process
    proc.unref();
  }
}

// Export a helper to check if we're in a Bun runtime
export const isBunRuntime = typeof Bun !== 'undefined';

// Export performance utilities
export const performance = {
  /**
   * Measure execution time with nanosecond precision
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!isBunRuntime) {
      // Fallback for non-Bun environments
      const start = Date.now();
      const result = await fn();
      console.log(`[Performance] ${name}: ${Date.now() - start}ms`);
      return result;
    }

    const start = Bun.nanoseconds();
    const result = await fn();
    const duration = (Bun.nanoseconds() - start) / 1_000_000;
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    return result;
  },

  /**
   * Create a high-resolution timer
   */
  createTimer() {
    const start = isBunRuntime ? Bun.nanoseconds() : Date.now();
    
    return {
      elapsed(): number {
        if (isBunRuntime) {
          return (Bun.nanoseconds() - start) / 1_000_000;
        }
        return Date.now() - start;
      },
      
      reset(): void {
        Object.assign(this, performance.createTimer());
      }
    };
  }
};