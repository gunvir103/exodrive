# ExoDrive Cache Integration Tests

This directory contains integration tests for the caching implementation across API endpoints.

## Overview

The integration tests verify:
- Cache behavior (HIT/MISS) for API endpoints
- Cache TTL expiration
- Cache invalidation on booking events
- Concurrent request handling
- Cache key generation correctness
- Error handling and fallback behavior

## Test Files

### `caching.test.ts`
Tests the basic caching functionality:
- First request (cache miss) vs second request (cache hit)
- Cache headers (X-Cache: HIT/MISS)
- TTL behavior
- Cache key generation
- Concurrent request handling
- Non-cacheable requests (POST)

### `cache-invalidation.test.ts`
Tests cache invalidation scenarios:
- Cache clearing on booking creation
- Cache clearing on booking cancellation
- Car update invalidation
- Event-based invalidation mapping
- Selective pattern-based invalidation
- Concurrent invalidation handling

### `test-helpers.ts`
Provides utilities for tests:
- Test data fixtures
- Database setup/cleanup functions
- Request helpers
- Test configuration

## Prerequisites

1. **Development server running**:
   ```bash
   bun run dev
   ```

2. **Environment variables set**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Database with test schema**:
   The tests expect the Supabase database to have the proper schema.

## Running the Tests

### Using the test runner script:
```bash
./tests/integration/run-tests.sh
```

### Running individual test files:
```bash
# Run caching tests only
bun test tests/integration/caching.test.ts

# Run cache invalidation tests only
bun test tests/integration/cache-invalidation.test.ts

# Run all integration tests with setup
bun test --preload ./tests/integration/setup.ts tests/integration/*.test.ts
```

### With custom server URL:
```bash
TEST_BASE_URL=http://localhost:3001 ./tests/integration/run-tests.sh
```

## Test Data

The tests use predefined test fixtures:
- Test cars with IDs: `550e8400-e29b-41d4-a716-446655440001`, `550e8400-e29b-41d4-a716-446655440002`
- Test customer with ID: `660e8400-e29b-41d4-a716-446655440001`

Test data is automatically:
- Set up before all tests run
- Cleaned up after all tests complete

## Environment Variables for Tests

```bash
# Server URL (defaults to http://localhost:3000)
TEST_BASE_URL=http://localhost:3000

# Database credentials (uses main app credentials by default)
TEST_SUPABASE_URL=your-supabase-url
TEST_SUPABASE_SERVICE_KEY=your-service-key

# Redis credentials (uses main app credentials by default)
TEST_REDIS_URL=your-redis-url
TEST_REDIS_TOKEN=your-redis-token
```

## Debugging Tests

### Enable verbose logging:
```bash
DEBUG=* bun test tests/integration/caching.test.ts
```

### Check Redis directly:
```bash
# In your application, you can add a debug endpoint or use Redis CLI
redis-cli --scan --pattern "fleet:*"
redis-cli --scan --pattern "availability:*"
```

### Common Issues

1. **"Server is not running" error**:
   - Ensure the development server is running: `bun run dev`
   - Check the TEST_BASE_URL is correct

2. **"Redis not available" warnings**:
   - Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set
   - Check Redis connection is working

3. **Test data conflicts**:
   - The setup script handles test data cleanup
   - If issues persist, manually clean test data from Supabase

## Writing New Cache Tests

When adding new cached endpoints:

1. Add test cases to `caching.test.ts`:
   ```typescript
   describe('New Endpoint Cache', () => {
     it('should cache responses correctly', async () => {
       // Test implementation
     });
   });
   ```

2. Add invalidation tests to `cache-invalidation.test.ts`:
   ```typescript
   describe('New Endpoint Invalidation', () => {
     it('should invalidate on relevant events', async () => {
       // Test implementation
     });
   });
   ```

3. Update test fixtures if needed in `test-helpers.ts`

## CI/CD Integration

To run these tests in CI:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  env:
    TEST_BASE_URL: ${{ secrets.TEST_BASE_URL }}
    UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL }}
    UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}
  run: |
    bun install
    bun run dev &
    sleep 5
    ./tests/integration/run-tests.sh
```