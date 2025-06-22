#!/usr/bin/env bun
/**
 * Test script for cache warming functionality
 */

import { cacheService, cacheWarmer, performance } from "../lib/redis";

async function testCacheWarming() {
  console.log("🧪 Testing cache warming functionality...\n");

  // Check Redis connection
  console.log("1️⃣ Checking Redis connection...");
  if (cacheService.isAvailable()) {
    console.log("✅ Redis is connected\n");
  } else {
    console.log("❌ Redis is not available. Please check your connection.\n");
    process.exit(1);
  }

  // Test basic cache operations
  console.log("2️⃣ Testing basic cache operations...");
  const testKey = "test:warming:key";
  const testData = { test: true, timestamp: new Date().toISOString() };
  
  await cacheService.set(testKey, testData, 60);
  const retrieved = await cacheService.get(testKey);
  
  if (JSON.stringify(retrieved) === JSON.stringify(testData)) {
    console.log("✅ Cache set/get operations working\n");
  } else {
    console.log("❌ Cache operations failed\n");
    process.exit(1);
  }

  // Clean up test key
  await cacheService.delete(testKey);

  // Test cache warming with minimal data
  console.log("3️⃣ Testing cache warming (minimal dataset)...");
  
  const metrics = await performance.measure("Cache warming test", async () => {
    return await cacheWarmer.warmCache({
      warmPopularCars: true,
      warmUpcomingAvailability: false,
      popularCarsLimit: 3,
      availabilityDays: 3
    });
  });

  console.log("\n📊 Warming Results:");
  console.log(`   Status: ${metrics.status}`);
  console.log(`   Keys warmed: ${metrics.keysWarmed}`);
  console.log(`   Duration: ${metrics.duration}ms`);
  console.log(`   Errors: ${metrics.errors.length}`);

  if (metrics.errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    metrics.errors.forEach(err => console.log(`   - ${err}`));
  }

  // Verify some data was cached
  console.log("\n4️⃣ Verifying cached data...");
  const fleetKey = cacheService.generateCacheKey("fleet:", "all");
  const fleetData = await cacheService.get(fleetKey);
  
  if (fleetData) {
    console.log("✅ Fleet data successfully cached");
  } else {
    console.log("⚠️  Fleet data not found in cache");
  }

  // Test metrics retrieval
  console.log("\n5️⃣ Testing metrics retrieval...");
  const lastMetrics = cacheWarmer.getMetrics();
  if (lastMetrics && lastMetrics.startTime) {
    console.log("✅ Metrics retrieval working");
  } else {
    console.log("❌ Metrics retrieval failed");
  }

  console.log("\n✨ All tests completed!");
  
  // Summary
  const allPassed = metrics.status !== 'failed' && fleetData !== null;
  
  if (allPassed) {
    console.log("\n🎉 Cache warming is working correctly!");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed. Please check the output above.");
    process.exit(1);
  }
}

// Run the test
testCacheWarming().catch(error => {
  console.error("❌ Test failed with error:", error);
  process.exit(1);
});