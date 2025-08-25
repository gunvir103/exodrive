# Rate Limiting Load Tests

This directory contains comprehensive load tests for the ExoDrive rate limiting system.

## Overview

The load tests verify that rate limiting works correctly under various concurrent load scenarios, ensuring:
- Accurate request counting without race conditions
- Proper enforcement of rate limits
- Correct rate limit headers
- Sliding window behavior
- Multi-user/IP isolation

## Test Scenarios

### 1. Public Endpoint Rate Limit (60 req/min)
- Tests rapid fire of 70 concurrent requests
- Verifies exactly 60 succeed and 10 are rejected
- Checks rate limit headers accuracy

### 2. Authenticated Endpoint Rate Limit (120 req/min)
- Tests higher limit for authenticated users
- Verifies isolation between different users
- Tests concurrent access from multiple users

### 3. Booking Endpoint Rate Limit (10 req/hr)
- Tests hourly rate limit enforcement
- Verifies long-window behavior
- Checks Retry-After header for hourly limits

### 4. Sliding Window Behavior
- Tests proper sliding window implementation
- Verifies old requests expire correctly
- Ensures accurate request counting over time

### 5. Rate Limit Headers Under Load
- Tests header accuracy during concurrent requests
- Verifies X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Checks Retry-After header when rate limited

### 6. Multiple IPs/Users Simultaneously
- Tests concurrent access from 10+ different IPs
- Verifies no interference between different identifiers
- Tests mixed authenticated and public users

### 7. Reset Behavior
- Tests automatic reset after window expiry
- Verifies manual reset functionality
- Ensures clean state after reset

## Running the Tests

### Prerequisites
- Bun runtime installed
- Redis/Upstash Redis configured (optional - tests will run without it)
- Environment variables set (REDIS_URL or UPSTASH_REDIS_REST_URL)

### Run all load tests:
```bash
bun test tests/load/rate-limiting.test.ts
```

### Run with the helper script:
```bash
bun run tests/load/run-load-tests.ts
```

### Run specific test suites:
```bash
# Run only public endpoint tests
bun test tests/load/rate-limiting.test.ts -t "Public endpoint"

# Run only race condition tests
bun test tests/load/rate-limiting.test.ts -t "Race condition"
```

## Performance Benchmarks

The tests include performance benchmarks that measure:
- Requests per second throughput
- Average latency per request
- Concurrent request handling

Expected performance:
- Minimum 1000 requests/second throughput
- Sub-millisecond average latency
- Linear scaling with concurrent requests

## Test Configuration

The tests use accelerated time windows for faster execution:
- Public: 60 requests per minute
- Authenticated: 120 requests per minute  
- Booking: 10 requests per hour
- Fast window (for testing): 5 requests per 2 seconds

## Architecture Notes

The rate limiter uses:
- Redis sorted sets for sliding window counting
- Atomic operations to prevent race conditions
- Pipeline commands for efficiency
- Graceful degradation when Redis is unavailable

## Troubleshooting

### Tests failing with Redis connection errors:
- Ensure REDIS_URL or UPSTASH_REDIS_REST_URL is set
- Verify Redis server is running and accessible
- Check network connectivity

### Rate limits not being enforced:
- Verify Redis is properly configured
- Check that middleware is applied to routes
- Ensure proper identifier extraction (IP/user ID)

### Performance issues:
- Use Redis pipeline for batch operations
- Ensure Redis instance has low latency
- Consider using Redis cluster for high load