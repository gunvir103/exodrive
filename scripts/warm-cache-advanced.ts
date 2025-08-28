#!/usr/bin/env bun
/**
 * Advanced Cache Warming Script with Bun optimizations
 * 
 * This script demonstrates advanced cache warming techniques using Bun's features
 */

import { cacheWarmer, BunCacheWarmer, performance } from "../lib/redis";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function advancedCacheWarming() {
  console.log("🚀 Starting advanced cache warming with Bun optimizations...\n");

  const totalTimer = performance.createTimer();
  const bunWarmer = new BunCacheWarmer();

  // Add warming tasks with priorities
  bunWarmer.addTask({
    name: "Critical: Popular Cars",
    priority: 10,
    execute: async () => {
      await cacheWarmer.warmCache({
        warmPopularCars: true,
        warmUpcomingAvailability: false,
        popularCarsLimit: 5
      });
    }
  });

  bunWarmer.addTask({
    name: "High: Fleet Listing",
    priority: 8,
    execute: async () => {
      const { data: cars } = await supabase
        .from("cars")
        .select("*")
        .eq("hidden", false);
      
      if (cars) {
        await performance.measure("Cache fleet listing", async () => {
          const { cacheService, cacheConfigs } = await import("../lib/redis");
          const cacheKey = cacheService.generateCacheKey(
            cacheConfigs.fleetListing.keyPrefix,
            "all"
          );
          await cacheService.set(cacheKey, { success: true, cars, count: cars.length }, 
            cacheConfigs.fleetListing.ttl);
        });
      }
    }
  });

  bunWarmer.addTask({
    name: "Medium: Recent Bookings Stats",
    priority: 5,
    execute: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: stats } = await supabase
        .from("bookings")
        .select("car_id, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .not("overall_status", "in", "(cancelled,disputed)");

      if (stats) {
        const { cacheService } = await import("../lib/redis");
        await cacheService.set("stats:recent-bookings", {
          count: stats.length,
          period: "30days",
          cached_at: new Date().toISOString()
        }, 3600); // 1 hour TTL
      }
    }
  });

  bunWarmer.addTask({
    name: "Low: Category Statistics",
    priority: 3,
    execute: async () => {
      // Get unique categories from cars table
      const { data: cars } = await supabase
        .from("cars")
        .select("category")
        .not("category", "is", null)
        .eq("hidden", false);

      if (cars) {
        const { cacheService } = await import("../lib/redis");
        
        // Get unique categories
        const uniqueCategories = Array.from(new Set(cars.map(car => car.category).filter(Boolean)));
        
        await BunCacheWarmer.batchWarmKeys(
          uniqueCategories.map(category => ({
            key: `category:stats:${category}`,
            fetcher: async () => {
              const { data: categoryStats } = await supabase
                .from("cars")
                .select("id", { count: "exact" })
                .eq("category", category)
                .eq("hidden", false);
              
              return {
                name: category,
                car_count: categoryStats?.length || 0
              };
            },
            ttl: 7200 // 2 hours
          })),
          5 // batch size
        );
      }
    }
  });

  // Execute all tasks with controlled concurrency
  console.log("📋 Executing warming tasks with concurrency control...\n");
  
  const metrics = await bunWarmer.executeTasks(5); // max 5 concurrent tasks
  
  const totalElapsed = totalTimer.elapsed();

  // Display results
  console.log("\n📊 Cache Warming Results");
  console.log("═".repeat(50));
  console.log(`✅ Status: ${metrics.status}`);
  console.log(`⏱️  Total time: ${totalElapsed.toFixed(2)}ms`);
  console.log(`🔑 Keys warmed: ${metrics.keysWarmed}`);
  
  if (metrics.errors.length > 0) {
    console.log(`\n⚠️  Errors (${metrics.errors.length}):`);
    metrics.errors.forEach(err => console.log(`  - ${err}`));
  }

  // Display task metrics
  const taskMetrics = bunWarmer.getTaskMetrics();
  if (taskMetrics.size > 0) {
    console.log("\n📈 Task Performance:");
    console.log("─".repeat(50));
    
    const sortedMetrics = Array.from(taskMetrics.entries())
      .sort((a, b) => b[1] - a[1]);
    
    sortedMetrics.forEach(([task, duration]) => {
      const bar = "█".repeat(Math.ceil(duration / 100));
      console.log(`  ${task.padEnd(30)} ${duration.toFixed(2).padStart(8)}ms ${bar}`);
    });
  }

  console.log("\n✨ Advanced cache warming completed!");
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes("--spawn")) {
  // Spawn as a separate process
  console.log("🚀 Spawning cache warming as a background process...");
  
  BunCacheWarmer.spawnWarmingProcess(__filename, args.filter(arg => arg !== "--spawn"));
  
  console.log("✅ Background process spawned. Check logs for progress.");
  process.exit(0);
} else if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Advanced Cache Warming Script

Usage:
  bunx scripts/warm-cache-advanced.ts [options]

Options:
  --spawn    Run the warming process in the background
  --help     Show this help message

This script demonstrates advanced cache warming features:
- Task prioritization
- Concurrency control
- Performance metrics
- Batch operations
- Bun-specific optimizations
`);
  process.exit(0);
} else {
  // Run directly
  advancedCacheWarming().catch(error => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}