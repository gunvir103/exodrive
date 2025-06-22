# Cache Warming Implementation

## Overview

The cache warming feature proactively loads frequently accessed data into Redis cache to improve performance and reduce database load during peak usage times.

## Components

### 1. Cache Warmer Service (`/lib/redis/cache-warmer.ts`)

The `CacheWarmer` class provides the core warming functionality:

- **Warm Popular Cars**: Identifies the most booked cars from the last 30 days and pre-loads their details
- **Warm Fleet Listing**: Pre-loads the entire car fleet listing
- **Warm Upcoming Availability**: Pre-loads availability data for popular cars for the next 7 days

Key features:
- Runs operations in parallel for efficiency
- Tracks metrics (duration, keys warmed, errors)
- Handles failures gracefully without blocking normal operations
- Uses Supabase service role for background operations

### 2. Admin API Endpoint (`/app/api/admin/cache-warm/route.ts`)

Provides two endpoints for administrators:

#### POST /api/admin/cache-warm
Triggers cache warming with configurable options:
```json
{
  "warmPopularCars": true,      // Default: true
  "warmUpcomingAvailability": true, // Default: true
  "popularCarsLimit": 10,        // Default: 10, Max: 50
  "availabilityDays": 7          // Default: 7, Max: 30
}
```

Returns warming metrics:
```json
{
  "success": true,
  "metrics": {
    "startTime": "2025-01-22T10:00:00.000Z",
    "endTime": "2025-01-22T10:00:05.123Z",
    "duration": 5123,
    "keysWarmed": 47,
    "status": "success",
    "errors": []
  },
  "message": "Cache warming success. Warmed 47 keys in 5123ms."
}
```

#### GET /api/admin/cache-warm
Returns the last warming metrics.

### 3. Optional Startup Warming (`/instrumentation.ts`)

Cache warming can be enabled on server startup by setting the environment variable:
```bash
CACHE_WARM_ON_STARTUP=true
```

When enabled:
- Waits 5 seconds after startup for services to initialize
- Runs cache warming in the background
- Logs results to console
- Does not block server startup

## Usage

### Manual Warming via Admin API

```bash
# Trigger cache warming with defaults
curl -X POST https://your-domain/api/admin/cache-warm \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Trigger with custom options
curl -X POST https://your-domain/api/admin/cache-warm \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "popularCarsLimit": 20,
    "availabilityDays": 14
  }'

# Check last warming status
curl https://your-domain/api/admin/cache-warm \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Automated Warming

For production environments, consider:

1. **Scheduled warming**: Use cron jobs or scheduled functions to warm cache during low-traffic periods
2. **Post-deployment warming**: Trigger warming after deploying new code
3. **Event-based warming**: Warm specific data after significant changes

Example cron job (runs at 3 AM daily):
```bash
0 3 * * * curl -X POST https://your-domain/api/admin/cache-warm -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Monitoring

The cache warmer logs detailed information:

```
[CacheWarmer] Starting cache warming...
[CacheWarmer] Warming 10 most popular cars...
[CacheWarmer] Warming fleet listing...
[CacheWarmer] Warming availability for next 7 days...
[CacheWarmer] Warmed fleet listing with 25 cars
[CacheWarmer] Warmed 10 popular cars
[CacheWarmer] Warmed availability for 10 cars
[CacheWarmer] Cache warming completed in 5123ms
[CacheWarmer] Keys warmed: 47
[CacheWarmer] Errors: 0
```

## Best Practices

1. **Schedule wisely**: Run cache warming during low-traffic periods (e.g., 3-5 AM)
2. **Monitor metrics**: Track warming duration and success rate
3. **Adjust limits**: Tune `popularCarsLimit` and `availabilityDays` based on your usage patterns
4. **Handle failures**: Cache warming failures should not affect normal operations
5. **Security**: Only allow admin users to trigger cache warming

## Environment Variables

```bash
# Required for cache warmer
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional - enable warming on startup
CACHE_WARM_ON_STARTUP=true
```

## Performance Impact

Cache warming typically:
- Takes 2-10 seconds depending on data volume
- Uses minimal CPU and memory
- Reduces database queries during peak hours
- Improves response times for popular data by 50-90%

## Troubleshooting

1. **No keys warmed**: Check if Redis is available and configured correctly
2. **Partial failures**: Check error logs for specific issues (usually database connectivity)
3. **Slow warming**: Consider reducing limits or running operations sequentially
4. **Missing popular cars**: Ensure booking data exists in the last 30 days