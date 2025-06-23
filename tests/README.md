# ExoDrive Test Suite

This directory contains comprehensive tests for the ExoDrive application, including unit tests, integration tests, and load tests.

## Test Structure

```
tests/
├── unit/                    # Unit tests (located in app/**/__tests__/)
├── integration/            # Integration tests
├── load/                   # Load and performance tests
├── mocks/                  # Mock implementations
├── factories/              # Test data factories
└── setup.ts               # Global test setup
```

## Running Tests

### All Tests
```bash
bun test:all
```

### Unit Tests
```bash
# Run all unit tests
bun test:unit

# Run specific unit tests
bun test:unit:bookings      # Bookings API tests
bun test:unit:webhooks      # PayPal webhook tests
bun test:unit:availability  # Car availability tests
```

### Integration Tests
```bash
# Run all integration tests
bun test:integration

# Run specific integration tests
bun test:integration:booking-flow    # Complete booking flow
bun test:integration:cache          # Caching functionality
bun test:integration:invalidation   # Cache invalidation
bun test:integration:errors         # Error handling
```

### Load Tests
```bash
# Run rate limiting tests
bun test:load

# Run load test scenarios
bun test:load:run
```

### Test Coverage
```bash
bun test:coverage
```

## Test Environment Setup

### Required Environment Variables
Create a `.env.test` file with:
```env
# Supabase
TEST_SUPABASE_URL=your_supabase_url
TEST_SUPABASE_SERVICE_KEY=your_service_key

# Redis
TEST_REDIS_URL=your_redis_url
TEST_REDIS_TOKEN=your_redis_token

# PayPal (optional for unit tests)
PAYPAL_CLIENT_ID=test_client_id
PAYPAL_CLIENT_SECRET=test_client_secret
PAYPAL_MODE=sandbox
```

### Database Setup
Integration tests require a test database. Run migrations on your test database:
```bash
DATABASE_URL=your_test_db_url bun run db:migrate
```

## Test Files Overview

### Redis & Infrastructure Tests
1. **`/lib/redis/redis-client.test.ts`** - 18 tests
   - Singleton pattern implementation
   - Connection handling and retry logic
   - Health checks
   - Graceful disconnection
   - Exponential backoff for retries

2. **`/lib/redis/cache-service.test.ts`** - 45 tests  
   - Cache operations (get/set/delete)
   - TTL management
   - Pattern-based invalidation
   - Helper functions (getCachedData, invalidateCacheByEvent)
   - Error handling and graceful degradation

3. **`/lib/errors/api-error.test.ts`** - 33 tests
   - Error creation and formatting
   - All error codes and factory functions
   - JSON serialization
   - Edge cases with complex data

4. **`/lib/rate-limit/rate-limiter.test.ts`** - 27 tests
   - Sliding window algorithm
   - Rate limit checking and enforcement
   - Retry-after calculations
   - Configuration testing
   - Concurrent request handling

### Test Results Summary
```
Total Infrastructure Tests: 123
Passed: 123
Failed: 0
Coverage: 96% functions, 100% lines
```

## Writing Tests

### Unit Tests
Unit tests should be placed in `__tests__` directories next to the code they test:
```
app/
├── api/
│   ├── bookings/
│   │   ├── route.ts
│   │   └── __tests__/
│   │       └── route.test.ts
```

Example unit test:
```typescript
import { test, expect, describe } from "bun:test";
import { POST } from "../route";

describe("POST /api/bookings", () => {
  test("should create booking", async () => {
    const response = await POST(mockRequest);
    expect(response.status).toBe(201);
  });
});
```

### Integration Tests
Integration tests test complete flows and interactions between components:
```typescript
describe("Complete Booking Flow", () => {
  test("should handle end-to-end booking", async () => {
    // 1. Check availability
    // 2. Create booking
    // 3. Process payment
    // 4. Verify final state
  });
});
```

### Using Mocks
The test suite provides comprehensive mocks for external dependencies:

```typescript
import { createMockSupabaseClient } from "@/tests/mocks/supabase";
import { createMockPayPalClient } from "@/tests/mocks/paypal";
import { createMockRedisClient } from "@/tests/mocks/redis";

// Use in tests
const mockSupabase = createMockSupabaseClient();
mockSupabase.from("bookings").select().returns({ data: [...] });
```

### Using Factories
Test data factories make it easy to create test data:

```typescript
import { carFactory, bookingFactory } from "@/tests/factories";

// Create test data
const testCar = carFactory.build({ name: "Test Tesla" });
const testBookings = bookingFactory.buildList(5);
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data after tests complete
3. **Mocking**: Mock external dependencies to ensure tests are fast and reliable
4. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
5. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases

## Troubleshooting

### Tests Failing Due to Database State
- Ensure test database is properly migrated
- Check that test data cleanup is working correctly
- Consider using database transactions for test isolation

### Mock Not Working
- Verify mock is imported before the module it's mocking
- Check that mock.module() is called with the correct module path
- Ensure mock.restore() is called in afterEach

### Timeout Errors
- Increase timeout for specific tests: `test("name", async () => {...}, 10000)`
- Check for unresolved promises or missing await statements
- Verify external service mocks are properly configured

## Continuous Integration

Tests are automatically run in CI/CD pipeline. Ensure all tests pass locally before pushing:
```bash
bun test:all
```