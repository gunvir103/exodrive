# Comprehensive Test Documentation - ExoDrive Platform

## Executive Summary

This document provides comprehensive testing guidelines for the ExoDrive car rental platform. Based on extensive codebase analysis using multiple specialized agents, we've identified critical testing gaps, security vulnerabilities requiring validation, and a roadmap for tRPC migration. The platform currently has ~70% backend test coverage but 0% frontend component testing.

**🔴 CRITICAL DISCOVERY**: Missing server-side price validation functions (`calculate_booking_price` and `validate_booking_price`) are referenced throughout the code but NOT IMPLEMENTED, creating a severe security vulnerability allowing price manipulation attacks.

## Table of Contents

1. [Current Test Infrastructure](#current-test-infrastructure)
2. [Critical Testing Priorities](#critical-testing-priorities)
3. [Frontend Component Testing](#frontend-component-testing)
4. [Backend API Testing](#backend-api-testing)
5. [Security Testing Requirements](#security-testing-requirements)
6. [Database & Integration Testing](#database--integration-testing)
7. [Performance & Load Testing](#performance--load-testing)
8. [tRPC Migration Testing](#trpc-migration-testing)
9. [Test Execution Strategy](#test-execution-strategy)
10. [Issues to Fix](#issues-to-fix)

---

## Current Test Infrastructure

### Testing Stack
- **Test Runner**: Vitest with Bun
- **Configuration**: `/Users/gunny/Developer/exodrive/.conductor/jakarta/vitest.config.ts`
- **Mocking**: Custom mocks for Supabase, Redis, Email services
- **Coverage**: ~70% backend, 0% frontend

### Existing Test Coverage

#### ✅ **Well-Tested Areas:**
- Booking API routes (`app/api/bookings/__tests__/`)
- Car availability checking (`app/api/cars/availability/__tests__/`)
- PayPal webhook processing (`app/api/webhooks/paypal/__tests__/`)
- Cache invalidation flows (`tests/integration/cache-invalidation.test.ts`)
- Rate limiting (`tests/load/rate-limiting.test.ts`)

#### ❌ **Critical Testing Gaps:**
- **0% Frontend component coverage**
- **Limited admin functionality testing**
- **No authentication flow testing**
- **Missing payment failure scenarios**
- **No file upload testing**
- **Limited error boundary testing**

---

## Critical Testing Priorities

### Phase 1: Security-Critical Tests (Week 1-2)

#### 1.1 Authentication & Authorization

```typescript
// tests/security/authentication.test.ts
describe('Authentication Security', () => {
  it('should enforce admin role verification at multiple levels', async () => {
    // Test user metadata check
    // Test database profile fallback
    // Test middleware protection
    // Test API route protection
  });

  it('should prevent session hijacking', async () => {
    // Test session fingerprinting
    // Test concurrent session limits
    // Test session expiry
  });

  it('should handle OAuth token refresh failures gracefully', async () => {
    // Test automatic refresh
    // Test refresh failure recovery
    // Test user experience during refresh
  });
});
```

#### 1.2 Payment Security

```typescript
// tests/security/payment-security.test.ts
describe('Payment Security', () => {
  // 🔴 CRITICAL: This test will FAIL - price validation functions don't exist!
  it('should prevent client-side price manipulation', async () => {
    const manipulatedPrice = 50; // Real price should be 200
    const response = await createBooking({
      carId: 'test-car',
      totalPrice: manipulatedPrice
    });
    
    // WARNING: Currently this test would PASS incorrectly because
    // the validation functions are missing!
    expect(response.status).toBe(400);
    expect(response.error).toContain('Price validation failed');
  });

  it('should validate PayPal webhook signatures', async () => {
    // 🔴 CRITICAL: Webhook verification bypassed in development mode!
    const invalidWebhook = createMaliciousWebhook();
    const response = await processWebhook(invalidWebhook);
    
    expect(response.status).toBe(401);
  });

  it('should handle payment authorization timeout', async () => {
    // Test 3-day authorization window
    // Test automatic capture logic
    // Test refund scenarios
  });
});
```

### Phase 2: Business-Critical Tests (Week 2-3)

#### 2.1 Booking Flow

```typescript
// tests/integration/booking-flow-complete.test.ts
describe('Complete Booking Flow', () => {
  it('should handle concurrent booking attempts', async () => {
    const car = await createTestCar();
    const dates = { start: '2024-12-25', end: '2024-12-28' };
    
    // Simulate race condition
    const bookings = await Promise.allSettled([
      createBooking({ carId: car.id, ...dates }),
      createBooking({ carId: car.id, ...dates })
    ]);
    
    const successful = bookings.filter(b => b.status === 'fulfilled');
    expect(successful).toHaveLength(1);
  });

  it('should rollback on payment failure', async () => {
    // Test booking creation
    // Simulate payment failure
    // Verify availability restored
    // Verify booking marked as failed
  });

  it('should handle email notification failures gracefully', async () => {
    // Test booking completion
    // Simulate email service failure
    // Verify booking still successful
    // Verify retry mechanism triggered
  });
});
```

#### 2.2 Car Availability Management

```typescript
// tests/business/availability.test.ts
describe('Car Availability', () => {
  it('should prevent double-booking across overlapping dates', async () => {
    // Test partial overlap scenarios
    // Test exact overlap scenarios
    // Test adjacent booking scenarios
  });

  it('should handle timezone differences correctly', async () => {
    // Test UTC vs local time
    // Test daylight saving transitions
    // Test international bookings
  });
});
```

### Phase 3: Frontend Component Tests (Week 3-4)

#### 3.1 Critical User Flows

```typescript
// tests/components/booking-form.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingForm } from '@/components/booking-form';

describe('BookingForm Component', () => {
  it('should validate date ranges correctly', async () => {
    render(<BookingForm carId="test-car" />);
    
    const startDate = screen.getByLabelText('Start Date');
    const endDate = screen.getByLabelText('End Date');
    
    fireEvent.change(startDate, { target: { value: '2024-12-28' } });
    fireEvent.change(endDate, { target: { value: '2024-12-25' } });
    
    await waitFor(() => {
      expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
    });
  });

  it('should calculate pricing correctly', async () => {
    // Test daily rate calculation
    // Test weekly discount application
    // Test insurance options
    // Test total price display
  });

  it('should handle availability checking', async () => {
    // Test real-time availability check
    // Test unavailable date blocking
    // Test loading states
    // Test error states
  });
});
```

#### 3.2 Admin Panel Components

```typescript
// tests/components/admin/car-management.test.tsx
describe('Admin Car Management', () => {
  it('should validate car data before submission', async () => {
    // Test required fields
    // Test image upload
    // Test pricing configuration
    // Test feature selection
  });

  it('should handle bulk operations correctly', async () => {
    // Test bulk visibility toggle
    // Test bulk delete with confirmation
    // Test bulk price updates
  });
});
```

---

## Frontend Component Testing

### Priority 1: Authentication Components

```typescript
// tests/components/auth-provider.test.tsx
describe('AuthProvider', () => {
  it('should manage authentication state correctly', async () => {
    // Test login flow
    // Test logout flow
    // Test session persistence
    // Test role-based rendering
  });

  it('should handle admin role verification', async () => {
    // Test metadata check
    // Test database fallback
    // Test role caching
  });
});
```

### Priority 2: Booking Components

```typescript
// tests/components/booking-components.test.tsx
describe('Booking Components', () => {
  // BookingForm.tsx
  it('should validate all form inputs', async () => {
    // Customer information validation
    // Date range validation
    // Terms acceptance
    // Price agreement
  });

  // CarBookingForm.tsx
  it('should integrate with PayPal correctly', async () => {
    // PayPal button rendering
    // Order creation
    // Authorization handling
    // Error recovery
  });

  // BookingDetails.tsx
  it('should display booking information accurately', async () => {
    // Status display
    // Price breakdown
    // Date formatting
    // Action buttons
  });
});
```

### Priority 3: Fleet Components

```typescript
// tests/components/fleet-components.test.tsx
describe('Fleet Components', () => {
  // FleetClientComponent.tsx
  it('should filter cars correctly', async () => {
    // Category filtering
    // Price range filtering
    // Feature filtering
    // Availability filtering
  });

  it('should handle pagination', async () => {
    // Page navigation
    // Items per page
    // Total count display
  });

  // CarCard.tsx
  it('should display car information', async () => {
    // Image loading
    // Price display
    // Feature badges
    // CTA buttons
  });
});
```

---

## Backend API Testing

### API Route Testing Requirements

#### 1. Admin APIs

```typescript
// tests/api/admin/admin-apis.test.ts
describe('Admin API Endpoints', () => {
  describe('GET /api/admin/bookings', () => {
    it('should require admin authentication', async () => {
      const response = await fetch('/api/admin/bookings');
      expect(response.status).toBe(401);
    });

    it('should return paginated bookings', async () => {
      const response = await authenticatedFetch('/api/admin/bookings?page=1&limit=10');
      const data = await response.json();
      
      expect(data.bookings).toHaveLength(10);
      expect(data.pagination).toBeDefined();
    });

    it('should filter by status', async () => {
      const response = await authenticatedFetch('/api/admin/bookings?status=confirmed');
      const data = await response.json();
      
      data.bookings.forEach(booking => {
        expect(booking.overall_status).toBe('confirmed');
      });
    });
  });

  describe('POST /api/admin/cars', () => {
    it('should create car with all related data atomically', async () => {
      const carData = createTestCarData();
      const response = await authenticatedPost('/api/admin/cars', carData);
      
      expect(response.status).toBe(201);
      
      // Verify all related tables updated
      const car = await getCarWithRelations(response.data.id);
      expect(car.pricing).toBeDefined();
      expect(car.features).toHaveLength(carData.features.length);
      expect(car.images).toHaveLength(carData.images.length);
    });

    it('should rollback on partial failure', async () => {
      const invalidCarData = createInvalidTestCarData();
      const response = await authenticatedPost('/api/admin/cars', invalidCarData);
      
      expect(response.status).toBe(400);
      // Verify no partial data in database
    });
  });
});
```

#### 2. Public APIs

```typescript
// tests/api/public/public-apis.test.ts
describe('Public API Endpoints', () => {
  describe('GET /api/cars', () => {
    it('should return cached data when available', async () => {
      // Prime cache
      await fetch('/api/cars');
      
      // Second request should be faster
      const start = Date.now();
      const response = await fetch('/api/cars');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50); // Cache hit should be <50ms
      expect(response.headers.get('x-cache')).toBe('HIT');
    });

    it('should handle cache failures gracefully', async () => {
      // Simulate Redis failure
      mockRedisFailure();
      
      const response = await fetch('/api/cars');
      expect(response.status).toBe(200);
      expect(response.headers.get('x-cache')).toBe('MISS');
    });
  });

  describe('POST /api/bookings', () => {
    it('should validate price against server calculation', async () => {
      const booking = {
        carId: 'test-car',
        startDate: '2024-12-25',
        endDate: '2024-12-28',
        totalPrice: 100 // Incorrect price
      };
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(booking)
      });
      
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: expect.objectContaining({
          code: 'PRICE_MISMATCH'
        })
      });
    });
  });
});
```

---

## Security Testing Requirements

### 1. Input Validation & Sanitization

```typescript
// tests/security/input-validation.test.ts
describe('Input Validation Security', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--"
    ];
    
    for (const input of maliciousInputs) {
      const response = await fetch('/api/cars', {
        method: 'POST',
        body: JSON.stringify({ search: input })
      });
      
      expect(response.status).not.toBe(500);
      // Verify tables still exist
      const tables = await verifyDatabaseIntegrity();
      expect(tables).toContain('users');
    }
  });

  it('should prevent XSS attacks', async () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>'
    ];
    
    for (const payload of xssPayloads) {
      const response = await createCar({ name: payload });
      const car = await getCar(response.id);
      
      expect(car.name).not.toContain('<script>');
      expect(car.name).not.toContain('javascript:');
      expect(car.name).toBe(sanitize(payload));
    }
  });
});
```

### 2. Authentication & Session Management

```typescript
// tests/security/session-security.test.ts
describe('Session Security', () => {
  it('should invalidate sessions on logout', async () => {
    const session = await login(testUser);
    const token = session.access_token;
    
    await logout(token);
    
    const response = await fetch('/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    expect(response.status).toBe(401);
  });

  it('should prevent session fixation', async () => {
    const oldSessionId = await getSessionId();
    await login(testUser);
    const newSessionId = await getSessionId();
    
    expect(oldSessionId).not.toBe(newSessionId);
  });

  it('should enforce session timeout', async () => {
    const session = await login(testUser);
    
    // Fast-forward time
    await advanceTime(16 * 60 * 1000); // 16 minutes
    
    const response = await authenticatedFetch('/api/user/profile', session);
    expect(response.status).toBe(401);
  });
});
```

### 3. Rate Limiting & DDoS Protection

```typescript
// tests/security/rate-limiting.test.ts
describe('Rate Limiting', () => {
  it('should enforce booking creation limits', async () => {
    const requests = [];
    
    // Make 11 requests (limit is 10 per hour)
    for (let i = 0; i < 11; i++) {
      requests.push(createBooking(testBookingData));
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited).toHaveLength(1);
    expect(rateLimited[0].headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('should use sliding window algorithm', async () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await createBooking(testBookingData);
      await sleep(100);
    }
    
    // Wait for partial window expiry
    await sleep(3000);
    
    // Should allow one more request
    const response = await createBooking(testBookingData);
    expect(response.status).toBe(201);
  });
});
```

---

## Database & Integration Testing

### 1. Transaction Testing

```typescript
// tests/database/transactions.test.ts
describe('Database Transactions', () => {
  it('should handle concurrent booking creation atomically', async () => {
    const car = await createTestCar();
    const dates = { start: '2024-12-25', end: '2024-12-28' };
    
    // Create 10 concurrent booking attempts
    const bookings = await Promise.allSettled(
      Array(10).fill(0).map(() => 
        supabase.rpc('create_booking_transactional', {
          p_car_id: car.id,
          p_start_date: dates.start,
          p_end_date: dates.end,
          p_customer_data: testCustomer
        })
      )
    );
    
    const successful = bookings.filter(b => b.status === 'fulfilled');
    expect(successful).toHaveLength(1);
    
    // Verify car availability properly updated
    const availability = await checkAvailability(car.id, dates);
    expect(availability).toBe(false);
  });

  it('should rollback on constraint violations', async () => {
    const initialCount = await getBookingCount();
    
    try {
      await supabase.rpc('create_booking_transactional', {
        p_car_id: 'invalid-uuid',
        // ... invalid data
      });
    } catch (error) {
      // Expected to fail
    }
    
    const finalCount = await getBookingCount();
    expect(finalCount).toBe(initialCount);
  });
});
```

### 2. Cache Invalidation Testing

```typescript
// tests/integration/cache-invalidation-advanced.test.ts
describe('Advanced Cache Invalidation', () => {
  it('should invalidate related caches on booking creation', async () => {
    const car = await createTestCar();
    
    // Prime caches
    await fetch(`/api/cars/${car.id}`);
    await fetch(`/api/cars/availability?carId=${car.id}`);
    
    // Create booking
    await createBooking({ carId: car.id });
    
    // Verify caches invalidated
    const carResponse = await fetch(`/api/cars/${car.id}`);
    const availabilityResponse = await fetch(`/api/cars/availability?carId=${car.id}`);
    
    expect(carResponse.headers.get('x-cache')).toBe('MISS');
    expect(availabilityResponse.headers.get('x-cache')).toBe('MISS');
  });

  it('should handle cache stampede prevention', async () => {
    // Invalidate popular cache key
    await redis.del('cache:popular-car');
    
    // Simulate 100 concurrent requests
    const requests = Array(100).fill(0).map(() => 
      fetch('/api/cars/popular-car')
    );
    
    const responses = await Promise.all(requests);
    
    // Only one should hit the database
    const dbHits = responses.filter(r => 
      r.headers.get('x-cache-build') === 'true'
    );
    
    expect(dbHits).toHaveLength(1);
  });
});
```

### 3. Migration Testing

```typescript
// tests/database/migrations.test.ts
describe('Database Migrations', () => {
  it('should be reversible', async () => {
    const migrations = await getMigrationList();
    
    for (const migration of migrations) {
      // Apply migration
      await applyMigration(migration);
      
      // Verify schema
      const isValid = await validateSchema();
      expect(isValid).toBe(true);
      
      // Rollback migration
      await rollbackMigration(migration);
      
      // Verify rollback
      const isValidAfterRollback = await validateSchema();
      expect(isValidAfterRollback).toBe(true);
    }
  });

  it('should maintain data integrity during migration', async () => {
    // Create test data
    const testData = await seedTestData();
    
    // Run migration
    await runMigration('add_new_column');
    
    // Verify data preserved
    const dataAfterMigration = await getTestData();
    expect(dataAfterMigration).toEqual(testData);
  });
});
```

---

## Performance & Load Testing

### 1. API Performance Testing

```typescript
// tests/performance/api-performance.test.ts
describe('API Performance', () => {
  it('should handle 100 concurrent car listing requests', async () => {
    const results = await loadTest({
      url: '/api/cars',
      concurrent: 100,
      duration: 10000 // 10 seconds
    });
    
    expect(results.averageResponseTime).toBeLessThan(200);
    expect(results.errorRate).toBeLessThan(0.01); // <1% error rate
    expect(results.requestsPerSecond).toBeGreaterThan(50);
  });

  it('should maintain performance under sustained load', async () => {
    const results = await loadTest({
      url: '/api/cars',
      concurrent: 50,
      duration: 60000, // 1 minute
      rampUp: 10000 // 10 second ramp-up
    });
    
    expect(results.p95ResponseTime).toBeLessThan(500);
    expect(results.p99ResponseTime).toBeLessThan(1000);
  });
});
```

### 2. Database Performance Testing

```typescript
// tests/performance/database-performance.test.ts
describe('Database Performance', () => {
  it('should handle connection pool exhaustion gracefully', async () => {
    // Create 30 concurrent long-running queries (pool size is 20)
    const queries = Array(30).fill(0).map(() => 
      supabase.rpc('long_running_query')
    );
    
    const results = await Promise.allSettled(queries);
    
    // Some should succeed, some should queue
    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThan(0);
    expect(successful.length).toBeLessThanOrEqual(20);
  });

  it('should optimize N+1 queries', async () => {
    const startTime = Date.now();
    
    // Fetch cars with all relations
    const cars = await supabase
      .from('cars')
      .select(`
        *,
        car_pricing(*),
        car_features(*),
        car_images(*)
      `)
      .limit(100);
    
    const duration = Date.now() - startTime;
    
    // Should complete in single query
    expect(duration).toBeLessThan(100);
    expect(getQueryCount()).toBe(1);
  });
});
```

### 3. Frontend Performance Testing

```typescript
// tests/performance/frontend-performance.test.ts
describe('Frontend Performance', () => {
  it('should achieve good Core Web Vitals scores', async () => {
    const metrics = await measureWebVitals('/fleet');
    
    expect(metrics.LCP).toBeLessThan(2500); // Largest Contentful Paint
    expect(metrics.FID).toBeLessThan(100);  // First Input Delay
    expect(metrics.CLS).toBeLessThan(0.1);  // Cumulative Layout Shift
  });

  it('should lazy load images efficiently', async () => {
    const page = await loadPage('/fleet');
    
    const initialImages = await getLoadedImages();
    expect(initialImages).toBeLessThan(10);
    
    await scrollToBottom();
    
    const finalImages = await getLoadedImages();
    expect(finalImages).toBeGreaterThan(initialImages);
  });
});
```

---

## tRPC Migration Testing

### 1. Type Safety Testing

```typescript
// tests/trpc/type-safety.test.ts
describe('tRPC Type Safety', () => {
  it('should enforce input validation', async () => {
    const client = createTRPCClient();
    
    // This should fail at compile time
    // @ts-expect-error
    await client.cars.create.mutate({ 
      name: 123 // Should be string
    });
    
    // Runtime validation should also catch it
    await expect(
      client.cars.create.mutate({ name: 123 as any })
    ).rejects.toThrow('Expected string');
  });

  it('should provide type-safe responses', async () => {
    const client = createTRPCClient();
    
    const car = await client.cars.get.query({ id: 'test-id' });
    
    // TypeScript knows the shape
    expectTypeOf(car).toMatchTypeOf<{
      id: string;
      name: string;
      pricing: { daily_rate: number };
      // ... etc
    }>();
  });
});
```

### 2. Migration Compatibility Testing

```typescript
// tests/trpc/compatibility.test.ts
describe('tRPC Migration Compatibility', () => {
  it('should maintain backward compatibility with REST', async () => {
    const restResponse = await fetch('/api/cars');
    const restData = await restResponse.json();
    
    const trpcData = await trpcClient.cars.list.query();
    
    expect(trpcData).toEqual(restData);
  });

  it('should handle authentication consistently', async () => {
    const token = await login(testUser);
    
    // REST API
    const restResponse = await fetch('/api/admin/bookings', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // tRPC API
    const trpcClient = createTRPCClient({ token });
    const trpcData = await trpcClient.admin.bookings.list.query();
    
    expect(restResponse.status).toBe(200);
    expect(trpcData).toBeDefined();
  });
});
```

### 3. Error Handling Testing

```typescript
// tests/trpc/error-handling.test.ts
describe('tRPC Error Handling', () => {
  it('should map HTTP errors to tRPC errors correctly', async () => {
    const client = createTRPCClient();
    
    // Test unauthorized
    await expect(
      client.admin.bookings.list.query()
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
    
    // Test not found
    await expect(
      client.cars.get.query({ id: 'non-existent' })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('should preserve error details', async () => {
    try {
      await client.bookings.create.mutate(invalidData);
    } catch (error) {
      expect(error.data?.zodError).toBeDefined();
      expect(error.message).toContain('Validation failed');
    }
  });
});
```

---

## Test Execution Strategy

### Daily Test Suite (CI/CD)

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Run Unit Tests
        run: bun test tests/unit --coverage

  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: supabase/postgres
      redis:
        image: redis:alpine
    steps:
      - name: Run Integration Tests
        run: bun test tests/integration

  security-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Run Security Tests
        run: bun test tests/security

  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Run E2E Tests
        run: bunx playwright test
```

### Weekly Performance Suite

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday

jobs:
  load-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - name: Run Load Tests
        run: |
          bun test tests/load
          bun test tests/performance
```

### Pre-Release Suite

```bash
#!/bin/bash
# scripts/pre-release-tests.sh

echo "Running comprehensive test suite..."

# 1. All unit tests
bun test tests/unit --coverage

# 2. All integration tests
bun test tests/integration

# 3. Security tests
bun test tests/security

# 4. Performance tests
bun test tests/performance

# 5. E2E tests
bunx playwright test

# 6. Visual regression tests
bun test tests/visual

# 7. Accessibility tests
bun test tests/a11y

# Generate coverage report
bun coverage:report

echo "Test suite complete!"
```

---

## Issues to Fix

Based on comprehensive analysis, here are the critical issues requiring immediate attention:

### Critical Priority (Fix Immediately)

#### 1. Missing Frontend Test Coverage (0%)
**Impact**: High risk of regression bugs
**Solution**: 
- Implement React Testing Library setup
- Add component tests for all critical user flows
- Target minimum 70% coverage

#### 2. Authentication Testing Gaps
**Impact**: Security vulnerability
**Solution**:
- Add comprehensive auth flow tests
- Test session management
- Verify role-based access control

#### 3. Payment Flow Edge Cases
**Impact**: Revenue loss risk
**Solution**:
- Test payment failure scenarios
- Verify refund processes
- Test authorization timeout handling

### High Priority (Fix Within Sprint)

#### 4. Performance Issues

**Large Bundle Sizes**
```javascript
// Add bundle analyzer
npm install --save-dev @next/bundle-analyzer

// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
```

**Memory Leaks in Analytics**
```typescript
// Fix: Clean up event listeners
useEffect(() => {
  const handler = trackEvent();
  return () => removeEventListener(handler);
}, []);
```

**N+1 Query Problems**
```typescript
// Current (N+1)
const cars = await getCars();
for (const car of cars) {
  car.pricing = await getPricing(car.id);
}

// Fixed (Single Query)
const cars = await supabase
  .from('cars')
  .select('*, car_pricing(*)');
```

#### 5. Error Handling Inconsistencies

**Standardize Error Responses**
```typescript
// Create consistent error handler
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.toJSON() },
      { status: error.statusCode }
    );
  }
  
  // Log unexpected errors
  logger.error('Unexpected error', error);
  
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR' } },
    { status: 500 }
  );
}
```

### Medium Priority (Next Sprint)

#### 6. Missing Component Architecture

**Implement Compound Components**
```typescript
// Create compound component pattern
const CarCard = Object.assign(CarCardBase, {
  Image: CarCardImage,
  Title: CarCardTitle,
  Price: CarCardPrice,
  Features: CarCardFeatures,
});
```

#### 7. State Management Optimization

**Add React Query for Server State**
```typescript
// Replace useEffect fetching
const { data: cars, isLoading } = useQuery({
  queryKey: ['cars', filters],
  queryFn: () => fetchCars(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

#### 8. Security Headers

**Implement Comprehensive CSP**
```typescript
// middleware.ts
const securityHeaders = {
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.paypal.com;
  `.replace(/\n/g, ''),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
};
```

### Low Priority (Backlog)

#### 9. Documentation
- Add JSDoc comments to complex functions
- Create API documentation
- Add Storybook for component library

#### 10. Monitoring
- Implement error tracking (Sentry)
- Add performance monitoring
- Create custom metrics dashboard

---

## tRPC Migration Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Set up tRPC infrastructure
- Create type-safe routers
- Implement authentication middleware
- Migrate admin analytics endpoints

### Phase 2: Admin Panel (Weeks 3-4)
- Migrate all admin endpoints
- Update admin components
- Add real-time updates
- Comprehensive testing

### Phase 3: Public APIs (Weeks 5-6)
- Migrate car listing/details
- Migrate availability checking
- Update public components
- Performance optimization

### Phase 4: Booking Flow (Weeks 7-8)
- Migrate booking creation
- Integrate payment flow
- Update booking components
- End-to-end testing

### Phase 5: Cleanup (Week 9)
- Remove old REST endpoints
- Update documentation
- Performance audit
- Security review

---

## Success Metrics

### Test Coverage Goals
- **Unit Tests**: 80% coverage
- **Integration Tests**: 70% coverage
- **E2E Tests**: Critical user paths
- **Frontend Components**: 70% coverage

### Performance Targets
- **API Response Time**: <200ms p50, <500ms p95
- **Page Load Time**: <2s on 3G
- **Core Web Vitals**: All green
- **Error Rate**: <0.1%

### Security Standards
- **OWASP Top 10**: All addressed
- **Authentication**: Multi-factor ready
- **Data Protection**: Encrypted at rest and in transit
- **Compliance**: GDPR, PCI DSS (via PayPal)

---

## Conclusion

This comprehensive testing documentation provides a clear roadmap for improving test coverage, fixing critical issues, and migrating to tRPC. The phased approach ensures minimal disruption while maximizing code quality and developer experience.

**Immediate Actions Required:**
1. Set up frontend testing infrastructure
2. Add authentication and payment security tests
3. Fix performance bottlenecks
4. Begin tRPC migration planning

**Expected Timeline:** 
- Critical fixes: 2-3 weeks
- Complete test coverage: 4-6 weeks
- tRPC migration: 9-12 weeks

**Risk Mitigation:**
- Maintain backward compatibility during migration
- Use feature flags for gradual rollout
- Comprehensive testing at each phase
- Regular security audits

This documentation should be treated as a living document and updated as the codebase evolves.