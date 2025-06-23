# Booking Race Condition Fix

## Overview

This document describes the pessimistic locking implementation that prevents race conditions during concurrent booking creation in the ExoDrive car rental platform.

## Problem Statement

The original booking system was vulnerable to race conditions where multiple users could simultaneously book the same car for overlapping dates. This occurred because the availability check and booking creation were not atomic operations.

## Solution Architecture

### 1. Database-Level Pessimistic Locking

The core of the solution is implemented in the `create_booking_transactional` PL/pgSQL function using PostgreSQL's row-level locking mechanisms:

#### Lock Acquisition Strategy

1. **Car Record Lock**: First acquires an exclusive lock on the car record using `SELECT ... FOR UPDATE NOWAIT`
2. **Availability Records Lock**: Locks all existing availability records for the requested date range
3. **Transaction Timeout**: Sets a 5-second lock timeout to prevent indefinite waiting

#### Lock Types Used

- `FOR UPDATE`: Acquires exclusive row-level locks preventing other transactions from modifying locked rows
- `NOWAIT`: Fails immediately if lock cannot be acquired instead of waiting
- `lock_timeout`: Transaction-level setting that causes lock acquisition to fail after specified time

### 2. Error Handling

The system handles several concurrency-related scenarios:

| Error Code | Description | HTTP Status | User Action |
|------------|-------------|-------------|-------------|
| `car_locked` | Another booking is being processed | 409 | Retry after a moment |
| `lock_timeout` | Lock acquisition timed out | 503 | Retry after a few seconds |
| `dates_unavailable` | Dates already booked | 409 | Select different dates |
| `transaction_failed` | Database error | 500 | Contact support |

### 3. API Layer Enhancements

The Next.js API route (`/api/bookings/route.ts`) includes:

- Redis-based distributed lock as an additional protection layer
- Detailed error mapping for user-friendly messages
- Retry guidance for transient failures
- Reduced Redis lock TTL (10s) since database handles primary locking

### 4. Edge Function Updates

The Supabase Edge Function properly maps database errors to appropriate HTTP status codes:
- 409 Conflict: For `car_locked` and `dates_unavailable`
- 503 Service Unavailable: For `lock_timeout`
- 400 Bad Request: For invalid input
- 500 Internal Server Error: For unexpected failures

## Implementation Details

### Database Migration

The migration (`20250624000000_fix_booking_race_condition.sql`) includes:

1. Updated `create_booking_transactional` function with pessimistic locking
2. Performance index for faster lock acquisition:
   ```sql
   CREATE INDEX idx_car_availability_booking_lookup 
   ON car_availability (car_id, date, status) 
   WHERE status IN ('pending_confirmation', 'booked', 'maintenance');
   ```

### Transaction Flow

1. **Begin Transaction**
   - Set lock timeout to 5 seconds
   - Validate input parameters

2. **Acquire Locks**
   - Lock car record with NOWAIT
   - Lock existing availability records for date range
   - Check for conflicts while holding locks

3. **Create Booking**
   - Insert customer record (if new)
   - Create booking record
   - Insert/update availability records
   - Log booking event

4. **Commit or Rollback**
   - Commit on success
   - Rollback and return appropriate error on failure

## Testing

### Automated Concurrency Test

Use the provided test script to verify the fix:

```bash
# Run concurrent booking attempts
bun run scripts/test-booking-concurrency.ts <car-id>
```

The test:
- Sends 5 concurrent booking requests for the same car and dates
- Verifies only one booking succeeds
- Reports timing and error statistics
- Automatically cleans up test data

### Expected Results

- Exactly 1 successful booking
- 4 failed attempts with "car_locked" or similar errors
- No duplicate bookings in the database
- All requests complete within reasonable time (typically < 1s)

## Performance Considerations

1. **Lock Contention**: The car-level lock may cause serialization for popular vehicles
2. **Lock Timeout**: 5-second timeout balances user experience with system stability
3. **Index Usage**: The new index improves lock acquisition performance
4. **Redis Cache**: Booking creation invalidates availability cache

## Monitoring

Key metrics to monitor:
- Lock timeout frequency
- Average booking creation time
- Concurrent booking attempt rate per car
- Error rates by type

## Future Improvements

1. **Optimistic Locking**: Consider optimistic approach for read-heavy scenarios
2. **Lock Granularity**: Date-specific locks instead of car-level locks
3. **Queue System**: Implement booking queue for high-demand vehicles
4. **Availability Pre-check**: Client-side availability verification to reduce conflicts