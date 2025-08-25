# Cache Warming Documentation

## Overview

The cache warming system pre-loads frequently accessed data into Redis cache to improve performance. It leverages Bun runtime features for optimal performance when available.

## Features

- **Parallel Processing**: Warms multiple cache entries concurrently
- **Bun Optimizations**: Uses Bun's nanosecond precision timing and async features
- **Background Execution**: Can run as a background process
- **Metrics Tracking**: Detailed metrics on warming performance
- **Admin API**: REST endpoint for triggering cache warming
- **CLI Scripts**: Command-line tools for manual or scheduled warming

## Components

### 1. Core Cache Warmer (`/lib/redis/cache-warmer.ts`)

The main cache warming service that:
- Warms popular car details based on booking frequency
- Warms fleet listing cache
- Warms upcoming availability for popular cars
- Tracks detailed metrics
- Supports Bun runtime optimizations

### 2. Bun-Optimized Utilities (`/lib/redis/cache-warmer-bun.ts`)

Advanced utilities for Bun runtime:
- Task-based warming with priorities
- Controlled concurrency
- Batch operations
- High-precision performance measurements

### 3. Admin API Endpoint (`/app/api/admin/cache-warm/route.ts`)

REST API for admins to trigger cache warming:

```bash
# Trigger cache warming
POST /api/admin/cache-warm
{
  "warmPopularCars": true,
  "warmUpcomingAvailability": true,
  "popularCarsLimit": 10,
  "availabilityDays": 7
}

# Get last warming metrics
GET /api/admin/cache-warm
```

### 4. CLI Scripts

#### Basic Cache Warming (`/scripts/warm-cache.ts`)

```bash
# Warm all caches
bunx scripts/warm-cache.ts

# Warm only popular cars
bunx scripts/warm-cache.ts --popular-only --limit 20

# Warm only availability
bunx scripts/warm-cache.ts --availability-only --days 14

# Run in background
bunx scripts/warm-cache.ts --background
```

#### Advanced Cache Warming (`/scripts/warm-cache-advanced.ts`)

```bash
# Run with detailed metrics
bunx scripts/warm-cache-advanced.ts

# Spawn as background process
bunx scripts/warm-cache-advanced.ts --spawn
```

## Configuration

### Environment Variables

```env
# Enable cache warming on server startup
ENABLE_CACHE_WARMING_ON_STARTUP=true

# Delay before warming starts (milliseconds)
CACHE_WARMING_STARTUP_DELAY=5000
```

### Startup Warming

To enable automatic cache warming on server startup:

```typescript
// In your app initialization
import '@/lib/redis/startup-warming';
```

## Usage Examples

### Programmatic Usage

```typescript
import { cacheWarmer } from '@/lib/redis';

// Basic warming
const metrics = await cacheWarmer.warmCache({
  warmPopularCars: true,
  warmUpcomingAvailability: true,
  popularCarsLimit: 10,
  availabilityDays: 7
});

// Non-blocking startup warming
await cacheWarmer.warmOnStartup();
```

### Using Bun-Specific Features

```typescript
import { BunCacheWarmer, performance } from '@/lib/redis';

const warmer = new BunCacheWarmer();

// Add prioritized tasks
warmer.addTask({
  name: "Critical Data",
  priority: 10,
  execute: async () => {
    // Warm critical data
  }
});

// Execute with concurrency control
const metrics = await warmer.executeTasks(5);

// Measure performance
await performance.measure("Warming operation", async () => {
  await someWarmingOperation();
});
```

### Scheduling with Cron

Add to your crontab for regular warming:

```bash
# Warm cache every hour
0 * * * * cd /path/to/project && bunx scripts/warm-cache.ts --background

# Warm cache at 6 AM daily with more data
0 6 * * * cd /path/to/project && bunx scripts/warm-cache.ts --limit 20 --days 14
```

## Metrics

The cache warmer tracks:
- Start and end times
- Total duration (with nanosecond precision in Bun)
- Number of keys warmed
- Errors encountered
- Overall status (success/partial/failed)

## Performance Considerations

1. **Batch Processing**: Operations are batched to avoid overwhelming the database
2. **Concurrency Control**: Limited concurrent operations prevent resource exhaustion
3. **Non-blocking**: Startup warming runs asynchronously
4. **Priority System**: Critical data is warmed first

## Best Practices

1. **Monitor Metrics**: Check warming metrics regularly to ensure effectiveness
2. **Adjust Parameters**: Tune `popularCarsLimit` and `availabilityDays` based on usage
3. **Schedule Wisely**: Run during low-traffic periods
4. **Error Handling**: Monitor error logs for failed warming operations
5. **Cache TTL**: Ensure warming frequency aligns with cache TTL settings