#!/usr/bin/env bun
/**
 * Cache Warming CLI Script
 * 
 * Usage:
 *   bunx scripts/warm-cache.ts
 *   bunx scripts/warm-cache.ts --popular-only
 *   bunx scripts/warm-cache.ts --availability-only
 *   bunx scripts/warm-cache.ts --limit 20 --days 14
 *   bunx scripts/warm-cache.ts --background
 */

import { cacheWarmer } from "../lib/redis/cache-warmer";
import type { CacheWarmingOptions } from "../lib/redis/cache-warmer";

// Parse command line arguments
const args = process.argv.slice(2);
const options: CacheWarmingOptions = {
  warmPopularCars: true,
  warmUpcomingAvailability: true,
  popularCarsLimit: 10,
  availabilityDays: 7,
};

let runInBackground = false;

// Simple argument parser
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case "--popular-only":
      options.warmUpcomingAvailability = false;
      break;
    case "--availability-only":
      options.warmPopularCars = false;
      break;
    case "--limit":
      const limit = parseInt(args[++i]);
      if (!isNaN(limit) && limit > 0) {
        options.popularCarsLimit = Math.min(limit, 50);
      }
      break;
    case "--days":
      const days = parseInt(args[++i]);
      if (!isNaN(days) && days > 0) {
        options.availabilityDays = Math.min(days, 30);
      }
      break;
    case "--background":
      runInBackground = true;
      break;
    case "--help":
    case "-h":
      console.log(`
Cache Warming Script

Usage:
  bunx scripts/warm-cache.ts [options]

Options:
  --popular-only        Only warm popular cars cache
  --availability-only   Only warm availability cache
  --limit <number>      Number of popular cars to warm (max 50, default 10)
  --days <number>       Number of days for availability (max 30, default 7)
  --background          Run warming in background process
  --help, -h           Show this help message

Examples:
  bunx scripts/warm-cache.ts
  bunx scripts/warm-cache.ts --popular-only --limit 20
  bunx scripts/warm-cache.ts --availability-only --days 14
  bunx scripts/warm-cache.ts --background
`);
      process.exit(0);
  }
}

async function warmCache() {
  console.log("🔥 Starting cache warming...");
  console.log("📊 Options:", {
    warmPopularCars: options.warmPopularCars,
    warmUpcomingAvailability: options.warmUpcomingAvailability,
    popularCarsLimit: options.popularCarsLimit,
    availabilityDays: options.availabilityDays,
  });
  
  const startTime = Bun.nanoseconds();
  
  try {
    const metrics = await cacheWarmer.warmCache(options);
    
    const duration = (Bun.nanoseconds() - startTime) / 1_000_000;
    
    console.log("\n✅ Cache warming completed!");
    console.log(`⏱️  Total duration: ${duration.toFixed(2)}ms`);
    console.log(`🔑 Keys warmed: ${metrics.keysWarmed}`);
    console.log(`📈 Status: ${metrics.status}`);
    
    if (metrics.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered (${metrics.errors.length}):`);
      metrics.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    process.exit(metrics.status === "failed" ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Fatal error during cache warming:", error);
    process.exit(1);
  }
}

// Run as background process if requested
if (runInBackground) {
  console.log("🚀 Spawning background cache warming process...");
  
  const proc = Bun.spawn({
    cmd: ["bun", "run", __filename, ...args.filter(arg => arg !== "--background")],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });
  
  console.log(`📌 Background process started with PID: ${proc.pid}`);
  console.log("💡 The process will continue running in the background.");
  
  // Exit the parent process
  process.exit(0);
} else {
  // Run cache warming directly
  warmCache();
}