# Cache Integration Tests

This directory contains comprehensive integration tests for the caching implementation in ExoDrive using Bun's test framework.

## Test Files

### 1. `caching.test.ts`
Tests the core caching functionality including:
- Cache hit/miss behavior
- TTL (Time To Live) validation
- Concurrent request handling
- Cache key generation
- Cache headers (X-Cache, X-Cache-Key)
- Non-cacheable request handling (POST requests)
- Error scenarios and fallback behavior

### 2. `cache-invalidation.test.ts`
Tests cache invalidation scenarios including:
- Booking creation invalidation
- Booking cancellation invalidation
- Car update invalidation
- Bulk cache invalidation
- Event-based invalidation mapping
- Concurrent invalidation requests
- Selective pattern-based invalidation

## Running the Tests

### Prerequisites
1. Ensure the development server is running on port 3005:
   ```bash
   bun run dev
   ```

2. Ensure Redis environment variables are set:
   ```bash
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   ```

### Running Tests

#### Run all integration tests:
```bash
bun run test:integration
```

#### Run only caching tests:
```bash
bun run test:integration:cache
```

#### Run only cache invalidation tests:
```bash
bun run test:integration:invalidation
```

#### Using the shell script:
```bash
./tests/integration/run-tests.sh
```

## Test Structure

### Test Setup
- `setup.ts`: Global setup and teardown
- `test-helpers.ts`: Utility functions and test fixtures
- Test data is automatically created before tests and cleaned up after

### Cache Configurations Tested

1. **Fleet Listing Cache**
   - TTL: 1 hour (3600 seconds)
   - Key prefix: `fleet:`
   - Invalidated on: car updates/creation/deletion

2. **Car Availability Cache**
   - TTL: 5 minutes (300 seconds)
   - Key prefix: `availability:`
   - Invalidated on: booking creation/cancellation

3. **Car Details Cache**
   - TTL: 30 minutes (1800 seconds)
   - Key prefix: `car:`
   - Invalidated on: car updates

## Key Test Scenarios

### Cache Hit/Miss Testing
```typescript
// First request - cache miss
const response1 = await fetch("http://localhost:3005/api/cars");
expect(response1.headers.get("X-Cache")).toBe("MISS");

// Second request - cache hit
const response2 = await fetch("http://localhost:3005/api/cars");
expect(response2.headers.get("X-Cache")).toBe("HIT");
```

### Concurrent Request Handling
```typescript
// Multiple simultaneous requests
const requests = Array(5).fill(null).map(() => 
  fetch("http://localhost:3005/api/cars")
);
const results = await Promise.all(requests);
```

### Cache Invalidation
```typescript
// Trigger event-based invalidation
await invalidateCacheByEvent('booking.created');

// Pattern-based invalidation
await cacheService.invalidate('availability:*');
```

## Test Data

The tests use predefined fixtures including:
- 2 test cars (Tesla Model 3, BMW M4)
- 1 test customer
- 90 days of availability data

## Debugging

To debug tests:
1. Check the test output for specific failures
2. Verify Redis connection with `redis-cli ping`
3. Check server logs for cache operations
4. Use `X-Cache` headers to verify cache behavior

## Environment Variables

- `TEST_BASE_URL`: Base URL for API requests (default: http://localhost:3005)
- `TEST_SUPABASE_URL`: Supabase URL for test database
- `TEST_SUPABASE_SERVICE_KEY`: Supabase service key
- `TEST_REDIS_URL`: Redis URL (defaults to UPSTASH_REDIS_REST_URL)
- `TEST_REDIS_TOKEN`: Redis token (defaults to UPSTASH_REDIS_REST_TOKEN)

## Best Practices

1. Always run tests with a clean cache state
2. Use the setup/teardown hooks for data consistency
3. Test both success and failure scenarios
4. Verify cache headers in responses
5. Test edge cases like empty results and errors