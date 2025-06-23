# Database Architecture & Optimization Plan

## Executive Summary

This document serves as the comprehensive guide for ExoDrive's database architecture, optimization strategies, and implementation guidelines. It is designed to be used by both human developers and AI agents for consistent, informed decision-making.

### Current State
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis (Upstash) 
- **Tables**: 20+ core tables including bookings, cars, customers, payments
- **Performance**: Mixed - some endpoints cached (<50ms), others slow (800ms+)
- **Issues**: Missing indexes, suboptimal queries, incomplete caching strategy

### Target State
- **Response Times**: <100ms for all user-facing queries
- **Cache Hit Rate**: >80% for read operations
- **Database Load**: 70% reduction through caching and optimization
- **Availability**: 99.9% uptime with automatic failover

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Performance Bottlenecks](#performance-bottlenecks)
3. [Optimization Strategy](#optimization-strategy)
4. [Implementation Guide](#implementation-guide)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Agent Reference Section](#agent-reference-section)

---

## Current Architecture Analysis

### Core Database Schema

```mermaid
erDiagram
    CUSTOMERS ||--o{ BOOKINGS : "makes"
    CARS ||--o{ BOOKINGS : "is booked"
    CARS ||--o{ CAR_AVAILABILITY : "has"
    BOOKINGS ||--o{ BOOKING_EVENTS : "generates"
    BOOKINGS ||--o{ PAYPAL_INVOICES : "has"
    BOOKINGS ||--|| BOOKING_SECURE_TOKENS : "secured by"
    CARS ||--o{ CAR_REVIEWS : "receives"
    BOOKINGS ||--o{ INBOX_EMAILS : "triggers"
    
    CUSTOMERS {
        uuid id PK
        uuid user_id FK
        text email
        text phone
        text name
        jsonb preferences
        timestamptz created_at
    }
    
    CARS {
        uuid id PK
        text make
        text model
        integer year
        numeric daily_rate
        boolean is_available
        numeric average_rating
        integer review_count
        jsonb features
        text location_id
    }
    
    BOOKINGS {
        uuid id PK
        uuid customer_id FK
        uuid car_id FK
        timestamptz start_date
        timestamptz end_date
        numeric total_amount
        booking_overall_status_enum overall_status
        payment_status_enum payment_status
        contract_status_enum contract_status
        text contract_document_id
        timestamptz contract_signed_at
    }
```

### Table Analysis

#### 1. **bookings** (Core Transaction Table)
- **Size**: ~10K-100K rows expected
- **Growth**: ~100-500 rows/day
- **Current Indexes**: 
  - PRIMARY KEY (id)
  - INDEX (customer_id)
  - INDEX (car_id)
- **Missing Indexes**:
  - COMPOSITE (customer_id, overall_status, created_at) - for customer history
  - COMPOSITE (car_id, start_date, end_date) - for availability checks
  - INDEX (overall_status) WHERE overall_status IN ('confirmed', 'in_progress')
- **RLS Policies**: ✓ Implemented
- **Performance Issues**: 
  - Slow customer booking history queries (no composite index)
  - Availability overlap checks doing full table scans

#### 2. **cars** (Inventory Table)
- **Size**: ~100-1000 rows
- **Growth**: Minimal
- **Current Indexes**:
  - PRIMARY KEY (id)
  - INDEX (is_available)
- **Missing Indexes**:
  - COMPOSITE (is_available, location_id, average_rating DESC) - for filtered listings
  - INDEX (make, model) - for search
- **Caching**: ✓ Implemented (1 hour TTL)
- **Performance Issues**: 
  - Complex JOIN queries for feature filtering
  - No full-text search capability

#### 3. **car_availability** (Calendar Table)
- **Size**: ~365 days × cars = 36K-365K rows
- **Growth**: Daily updates
- **Current Indexes**:
  - INDEX (car_id)
  - INDEX (date)
- **Missing Indexes**:
  - COMPOSITE (car_id, date, status) - critical for performance
  - UNIQUE (car_id, date) - data integrity
- **Performance Issues**:
  - Date range queries very slow
  - No partitioning by date

#### 4. **booking_events** (Audit/Timeline Table)
- **Size**: ~10-20 events per booking
- **Growth**: High volume
- **Current Indexes**:
  - COMPOSITE (booking_id, timestamp DESC)
  - INDEX (event_type)
- **Missing Indexes**:
  - INDEX (timestamp) - for time-based queries
  - PARTIAL INDEX (event_type) WHERE event_type IN ('payment_received', 'cancelled')
- **Performance Issues**:
  - No archival strategy
  - Growing unbounded

#### 5. **customers** (User Table)
- **Size**: ~1K-10K rows
- **Growth**: ~10-50 rows/day
- **Current Indexes**:
  - PRIMARY KEY (id)
  - UNIQUE (user_id)
  - UNIQUE (email)
- **Performance**: ✓ Adequate
- **Caching Opportunity**: User sessions

#### 6. **car_reviews** (Rating Table)
- **Size**: ~1-10 reviews per car
- **Current Indexes**:
  - INDEX (car_id)
  - INDEX (customer_id)
  - PARTIAL INDEX (is_approved) WHERE is_approved = true
- **Performance**: ✓ Adequate with current indexes
- **Caching Opportunity**: Aggregate ratings

#### 7. **inbox_emails** (Communication Log)
- **Size**: Growing unbounded
- **Current Indexes**:
  - INDEX (resend_email_id)
  - INDEX (booking_id)
  - INDEX (recipient_email)
- **Missing Indexes**:
  - COMPOSITE (booking_id, created_at DESC) - for booking email history
  - GIN INDEX on tags (JSONB) - for tag filtering
- **Performance Issues**:
  - No archival/retention policy

### Database Configuration Analysis

```sql
-- Current PostgreSQL Configuration (Supabase defaults)
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

-- Recommended Optimizations
max_connections = 200  -- Increase for growth
shared_buffers = 512MB  -- Better caching
effective_cache_size = 2GB  -- Match instance RAM
work_mem = 16MB  -- Faster sorts/joins
maintenance_work_mem = 128MB  -- Faster index creation
```

---

## Performance Bottlenecks

### 1. Query Performance Issues

#### A. Booking Availability Check (CRITICAL)
**Current Performance**: 800ms+
```sql
-- Current slow query
SELECT * FROM car_availability 
WHERE car_id = $1 
  AND date BETWEEN $2 AND $3 
  AND status = 'available';
```

**Root Cause**: 
- No composite index on (car_id, date, status)
- Full table scan on date range
- No query result caching

**Solution**:
```sql
-- Add composite index
CREATE INDEX idx_car_availability_lookup 
ON car_availability(car_id, date, status) 
WHERE status = 'available';

-- Implement Redis caching
Cache Key: availability:{car_id}:{start_date}:{end_date}
TTL: 5 minutes
```

#### B. Customer Booking History (HIGH)
**Current Performance**: 500ms+
```sql
-- Current slow query
SELECT b.*, c.make, c.model, c.year
FROM bookings b
JOIN cars c ON b.car_id = c.id
WHERE b.customer_id = $1
ORDER BY b.created_at DESC
LIMIT 20;
```

**Root Cause**:
- No composite index for customer queries
- Unnecessary JOIN for listing page
- No pagination optimization

**Solution**:
```sql
-- Add composite index
CREATE INDEX idx_bookings_customer_history 
ON bookings(customer_id, created_at DESC)
INCLUDE (car_id, overall_status, total_amount);

-- Denormalize car info or use separate query
-- Cache recent bookings per customer
```

#### C. Fleet Search and Filter (MEDIUM)
**Current Performance**: 400ms+
```sql
-- Complex filtering query
SELECT DISTINCT c.* 
FROM cars c
LEFT JOIN car_features cf ON c.id = cf.car_id
WHERE c.is_available = true
  AND c.location_id = $1
  AND cf.name IN ('GPS', 'Bluetooth')
GROUP BY c.id
HAVING COUNT(DISTINCT cf.name) = 2
ORDER BY c.average_rating DESC;
```

**Root Cause**:
- Multiple JOIN operations
- GROUP BY on large result sets
- No index on feature combinations

**Solution**:
```sql
-- Add GIN index for features
ALTER TABLE cars ADD COLUMN features_array text[];
CREATE INDEX idx_cars_features ON cars USING GIN(features_array);

-- Composite index for common queries
CREATE INDEX idx_cars_search 
ON cars(is_available, location_id, average_rating DESC)
WHERE is_available = true;
```

### 2. Caching Gaps

#### Current Cache Coverage
| Endpoint | Cached | TTL | Hit Rate |
|----------|--------|-----|----------|
| /api/cars | ✓ | 1hr | 85% |
| /api/cars/[id] | ✓ | 30min | 75% |
| /api/cars/availability | ✓ | 5min | 60% |
| /api/bookings | ✗ | - | 0% |
| /api/customers/[id]/bookings | ✗ | - | 0% |
| /api/admin/dashboard | ✗ | - | 0% |

#### Recommended Cache Additions
```typescript
// 1. User Session Cache
Key: session:{user_id}
Data: { user, customer, preferences, recentBookings }
TTL: 15 minutes
Invalidate: On user update, new booking

// 2. Dashboard Metrics Cache  
Key: dashboard:metrics:{date}
Data: { totalBookings, revenue, utilization, topCars }
TTL: 15 minutes
Invalidate: On new booking, payment

// 3. Search Results Cache
Key: search:{location}:{filters_hash}
Data: Car listing results
TTL: 10 minutes
Invalidate: On car update, availability change

// 4. Booking Details Cache
Key: booking:{id}:details
Data: Full booking with relations
TTL: 1 hour
Invalidate: On booking update, payment
```

### 3. Database Connection Issues

#### Current Problems
- No connection pooling (direct connections)
- No retry logic for transient failures
- No read replica routing
- Connection limit reached during peak times

#### Solutions
```typescript
// 1. Implement PgBouncer Configuration
[databases]
exodrive = host=db.supabase.co port=5432 dbname=postgres

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 100
```

---

## Optimization Strategy

### Phase 1: Critical Performance Fixes (Week 1)

#### 1.1 Index Creation Script
```sql
-- CRITICAL: Availability lookup performance
CREATE INDEX CONCURRENTLY idx_car_availability_lookup 
ON car_availability(car_id, date, status) 
WHERE status = 'available';

-- HIGH: Customer booking history
CREATE INDEX CONCURRENTLY idx_bookings_customer_history 
ON bookings(customer_id, created_at DESC)
INCLUDE (car_id, overall_status, total_amount);

-- HIGH: Active bookings lookup
CREATE INDEX CONCURRENTLY idx_bookings_active 
ON bookings(overall_status, start_date, end_date)
WHERE overall_status IN ('confirmed', 'in_progress');

-- MEDIUM: Fleet search optimization
CREATE INDEX CONCURRENTLY idx_cars_search 
ON cars(is_available, location_id, average_rating DESC)
WHERE is_available = true;

-- MEDIUM: Email tracking
CREATE INDEX CONCURRENTLY idx_inbox_emails_booking_history
ON inbox_emails(booking_id, created_at DESC);
```

#### 1.2 Query Optimization Examples
```typescript
// Before: N+1 query problem
const bookings = await supabase
  .from('bookings')
  .select('*')
  .eq('customer_id', customerId);

for (const booking of bookings) {
  const car = await supabase
    .from('cars')
    .select('*')
    .eq('id', booking.car_id)
    .single();
}

// After: Single query with selective fields
const bookings = await supabase
  .from('bookings')
  .select(`
    id,
    start_date,
    end_date,
    total_amount,
    overall_status,
    car:cars!inner(
      id,
      make,
      model,
      year,
      image_url
    )
  `)
  .eq('customer_id', customerId)
  .order('created_at', { ascending: false })
  .limit(20);
```

### Phase 2: Caching Implementation (Week 2-3)

#### 2.1 Cache Service Extensions
```typescript
// lib/redis/cache-patterns.ts
export class CachePatterns {
  // Cache-aside pattern for user sessions
  async getUserSession(userId: string): Promise<UserSession | null> {
    const cacheKey = `session:${userId}`;
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    // Load from database
    const session = await this.loadUserSession(userId);
    if (session) {
      await redis.setex(cacheKey, 900, JSON.stringify(session)); // 15 min
    }
    
    return session;
  }
  
  // Write-through pattern for bookings
  async createBooking(data: BookingData): Promise<Booking> {
    const booking = await this.db.createBooking(data);
    
    // Update multiple cache entries
    await Promise.all([
      // Invalidate availability cache
      redis.del(`availability:${data.carId}:*`),
      // Update customer bookings cache
      redis.del(`customer:${data.customerId}:bookings`),
      // Cache the new booking
      redis.setex(`booking:${booking.id}`, 3600, JSON.stringify(booking))
    ]);
    
    return booking;
  }
  
  // Cache warming for dashboard
  async warmDashboardCache(): Promise<void> {
    const metrics = await this.calculateDashboardMetrics();
    const date = new Date().toISOString().split('T')[0];
    
    await redis.setex(
      `dashboard:metrics:${date}`,
      900, // 15 minutes
      JSON.stringify(metrics)
    );
  }
}
```

#### 2.2 Cache Invalidation Strategy
```typescript
// lib/redis/cache-invalidation.ts
export class CacheInvalidation {
  private invalidationRules = {
    'cars.update': [
      (carId: string) => `car:${carId}`,
      () => 'fleet:all',
      (carId: string) => `search:*`
    ],
    'bookings.create': [
      (booking: Booking) => `availability:${booking.car_id}:*`,
      (booking: Booking) => `customer:${booking.customer_id}:bookings`,
      () => 'dashboard:metrics:*'
    ],
    'bookings.update': [
      (booking: Booking) => `booking:${booking.id}`,
      (booking: Booking) => `booking:${booking.id}:*`
    ]
  };
  
  async invalidate(event: string, data: any): Promise<void> {
    const rules = this.invalidationRules[event] || [];
    const keysToDelete: string[] = [];
    
    for (const rule of rules) {
      const pattern = rule(data);
      if (pattern.includes('*')) {
        // Scan for matching keys
        const keys = await redis.keys(pattern);
        keysToDelete.push(...keys);
      } else {
        keysToDelete.push(pattern);
      }
    }
    
    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  }
}
```

### Phase 3: Schema Enhancements (Week 4-6)

#### 3.1 Add Missing Constraints
```sql
-- Ensure data integrity
ALTER TABLE car_availability 
ADD CONSTRAINT uk_car_availability_date 
UNIQUE (car_id, date);

ALTER TABLE bookings
ADD CONSTRAINT chk_booking_dates 
CHECK (start_date < end_date);

ALTER TABLE bookings
ADD CONSTRAINT chk_booking_amount 
CHECK (total_amount >= 0);

-- Add missing foreign keys
ALTER TABLE inbox_emails
ADD CONSTRAINT fk_inbox_emails_booking
FOREIGN KEY (booking_id) 
REFERENCES bookings(id) 
ON DELETE SET NULL;
```

#### 3.2 Add Audit Fields
```sql
-- Add soft delete support
ALTER TABLE bookings 
ADD COLUMN deleted_at TIMESTAMPTZ,
ADD COLUMN deleted_by UUID;

ALTER TABLE customers
ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add optimistic locking
ALTER TABLE bookings
ADD COLUMN version INTEGER DEFAULT 1;

-- Add audit tracking
ALTER TABLE bookings
ADD COLUMN updated_by UUID,
ADD COLUMN updated_by_type actor_type_enum;
```

#### 3.3 Create Analytics Tables
```sql
-- Materialized view for dashboard performance
CREATE MATERIALIZED VIEW booking_analytics AS
SELECT 
  DATE_TRUNC('day', b.created_at) as booking_date,
  COUNT(*) as total_bookings,
  COUNT(DISTINCT b.customer_id) as unique_customers,
  SUM(b.total_amount) as revenue,
  AVG(b.total_amount) as avg_booking_value,
  COUNT(*) FILTER (WHERE b.overall_status = 'completed') as completed_bookings,
  COUNT(*) FILTER (WHERE b.overall_status = 'cancelled') as cancelled_bookings
FROM bookings b
WHERE b.deleted_at IS NULL
GROUP BY DATE_TRUNC('day', b.created_at);

-- Index for fast queries
CREATE INDEX idx_booking_analytics_date 
ON booking_analytics(booking_date DESC);

-- Refresh schedule (daily at 2 AM)
CREATE OR REPLACE FUNCTION refresh_booking_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY booking_analytics;
END;
$$ LANGUAGE plpgsql;
```

### Phase 4: Advanced Optimizations (Month 2-3)

#### 4.1 Partitioning Strategy
```sql
-- Partition car_availability by month for better performance
CREATE TABLE car_availability_new (
  LIKE car_availability INCLUDING ALL
) PARTITION BY RANGE (date);

-- Create partitions for next 12 months
DO $$
DECLARE
  start_date date;
  end_date date;
BEGIN
  FOR i IN 0..11 LOOP
    start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::interval);
    end_date := DATE_TRUNC('month', start_date + '1 month'::interval);
    
    EXECUTE format(
      'CREATE TABLE car_availability_%s PARTITION OF car_availability_new
       FOR VALUES FROM (%L) TO (%L)',
      TO_CHAR(start_date, 'YYYY_MM'),
      start_date,
      end_date
    );
  END LOOP;
END $$;
```

#### 4.2 Background Job Queue
```typescript
// lib/jobs/job-queue.ts
import Bull from 'bull';
import { createClient } from 'redis';

export const queues = {
  email: new Bull('email', {
    redis: process.env.REDIS_URL,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 1000,
    }
  }),
  
  contracts: new Bull('contracts', {
    redis: process.env.REDIS_URL,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      }
    }
  }),
  
  analytics: new Bull('analytics', {
    redis: process.env.REDIS_URL,
    defaultJobOptions: {
      repeat: {
        cron: '0 2 * * *' // Daily at 2 AM
      }
    }
  })
};

// Job processors
queues.email.process(async (job) => {
  const { to, subject, template, data } = job.data;
  await sendEmail(to, subject, template, data);
});

queues.analytics.process(async (job) => {
  await refreshMaterializedViews();
  await warmDashboardCache();
});
```

---

## Implementation Guide

### Step-by-Step Implementation

#### Week 1: Critical Performance Fixes
1. **Day 1-2**: Create and test indexes in development
   ```bash
   # Generate index creation script
   psql $DATABASE_URL -f scripts/create_indexes.sql
   
   # Monitor index creation progress
   SELECT * FROM pg_stat_progress_create_index;
   ```

2. **Day 3-4**: Implement connection pooling
   ```bash
   # Install pgBouncer
   docker run -d --name pgbouncer \
     -e DATABASES_HOST=db.supabase.co \
     -e DATABASES_PORT=5432 \
     -e DATABASES_DATABASE=postgres \
     -p 6432:6432 \
     pgbouncer/pgbouncer
   ```

3. **Day 5**: Deploy and monitor
   - Roll out to staging environment
   - Monitor query performance
   - Check for index usage

#### Week 2-3: Caching Implementation
1. **Extend cache service** with new patterns
2. **Implement cache warming** for critical data
3. **Add cache monitoring** and alerting
4. **Test cache invalidation** scenarios

#### Week 4-6: Schema Enhancements
1. **Add constraints** and audit fields
2. **Create materialized views** for analytics
3. **Implement soft deletes** where appropriate
4. **Set up background jobs** for maintenance

### Testing Strategy

#### 1. Performance Testing
```typescript
// tests/performance/database.test.ts
describe('Database Performance', () => {
  it('should return availability in <100ms', async () => {
    const start = Date.now();
    const result = await checkAvailability(carId, startDate, endDate);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('should handle 100 concurrent requests', async () => {
    const requests = Array(100).fill(null).map(() => 
      checkAvailability(carId, startDate, endDate)
    );
    
    const results = await Promise.all(requests);
    expect(results).toHaveLength(100);
  });
});
```

#### 2. Cache Testing
```typescript
// tests/integration/caching.test.ts
describe('Cache Behavior', () => {
  it('should invalidate related caches on booking creation', async () => {
    // Warm cache
    await getCarAvailability(carId, dates);
    expect(await redis.exists(`availability:${carId}:*`)).toBe(1);
    
    // Create booking
    await createBooking({ carId, ...bookingData });
    
    // Check cache invalidated
    expect(await redis.exists(`availability:${carId}:*`)).toBe(0);
  });
});
```

### Rollback Procedures

#### Index Rollback
```sql
-- Drop indexes if performance degrades
DROP INDEX CONCURRENTLY IF EXISTS idx_car_availability_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_bookings_customer_history;
```

#### Cache Rollback
```typescript
// Disable caching by environment variable
if (process.env.DISABLE_CACHE === 'true') {
  return await fetchFromDatabase();
}
```

---

## Monitoring & Maintenance

### Key Metrics to Track

#### 1. Database Metrics
```sql
-- Query performance
CREATE VIEW slow_queries AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Table bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_live_tup,
  n_dead_tup,
  round(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

#### 2. Cache Metrics
```typescript
// lib/monitoring/cache-metrics.ts
export class CacheMetrics {
  private hits = 0;
  private misses = 0;
  
  async get(key: string): Promise<any> {
    const value = await redis.get(key);
    
    if (value) {
      this.hits++;
      metrics.increment('cache.hit', { key });
    } else {
      this.misses++;
      metrics.increment('cache.miss', { key });
    }
    
    return value;
  }
  
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : (this.hits / total) * 100;
  }
}
```

### Maintenance Tasks

#### Daily Tasks
1. Check slow query log
2. Monitor cache hit rates
3. Review error rates
4. Check connection pool usage

#### Weekly Tasks
1. Analyze query patterns
2. Update table statistics
3. Review index usage
4. Check for table bloat

#### Monthly Tasks
1. Full database vacuum
2. Index rebuild if needed
3. Archive old data
4. Review and update cache TTLs

### Alerting Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: database
    rules:
      - alert: SlowQueries
        expr: database_query_duration_seconds > 1
        for: 5m
        annotations:
          summary: "Slow database queries detected"
          
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.7
        for: 10m
        annotations:
          summary: "Cache hit rate below 70%"
          
      - alert: HighConnectionCount
        expr: database_connections_active > 80
        for: 5m
        annotations:
          summary: "High database connection count"
```

---

## Agent Reference Section

### Purpose
This section provides structured information for AI agents to make consistent, optimized decisions when working with the database.

### Table Metadata Reference

```yaml
tables:
  bookings:
    primary_key: id
    size_category: large  # >10K rows
    growth_rate: high  # >100 rows/day
    cache_strategy: write-through
    cache_ttl: 3600  # 1 hour
    critical_indexes:
      - customer_history: "customer_id, created_at DESC"
      - active_bookings: "overall_status, start_date"
    common_queries:
      - pattern: "customer booking history"
        index_hint: "customer_history"
        cache_key: "customer:{customer_id}:bookings"
      - pattern: "active bookings by date"
        index_hint: "active_bookings"
        cache_key: "bookings:active:{date}"
    relationships:
      - table: cars
        type: many-to-one
        join_column: car_id
      - table: customers
        type: many-to-one
        join_column: customer_id
    
  cars:
    primary_key: id
    size_category: small  # <1K rows
    growth_rate: minimal
    cache_strategy: cache-aside
    cache_ttl: 3600  # 1 hour
    critical_indexes:
      - availability_search: "is_available, location_id, average_rating DESC"
    common_queries:
      - pattern: "available cars by location"
        index_hint: "availability_search"
        cache_key: "cars:available:{location_id}"
    
  car_availability:
    primary_key: id
    size_category: large  # >100K rows
    growth_rate: high
    cache_strategy: cache-aside
    cache_ttl: 300  # 5 minutes
    critical_indexes:
      - availability_lookup: "car_id, date, status"
    partitioning: 
      strategy: "range"
      column: "date"
      interval: "monthly"
```

### Query Optimization Decision Tree

```yaml
query_optimization:
  - condition: "Query involves date ranges"
    checks:
      - "Is the table partitioned by date?"
      - "Is there a composite index including the date column?"
      - "Can the query use a bounded date range?"
    optimizations:
      - "Use partition pruning"
      - "Add date boundaries to WHERE clause"
      - "Consider materialized view for common date ranges"
  
  - condition: "Query joins multiple tables"
    checks:
      - "Are foreign key indexes present?"
      - "Is the join order optimal (small to large)?"
      - "Can some joins be eliminated?"
    optimizations:
      - "Ensure all FK columns are indexed"
      - "Use EXISTS instead of JOIN when possible"
      - "Consider denormalization for read-heavy queries"
  
  - condition: "Query uses COUNT or aggregations"
    checks:
      - "Is a materialized view available?"
      - "Can the count be approximated?"
      - "Is the aggregation cacheable?"
    optimizations:
      - "Create materialized view for common aggregations"
      - "Use pg_stat_user_tables for approximate counts"
      - "Cache aggregation results with appropriate TTL"
```

### Cache Key Generation Rules

```typescript
// Standardized cache key patterns for consistency
interface CacheKeyPatterns {
  // Single entity
  entity: (table: string, id: string) => string;
  // "{table}:{id}"
  // Example: "car:123e4567-e89b-12d3-a456-426614174000"
  
  // List with filters
  list: (table: string, filters: Record<string, any>) => string;
  // "{table}:list:{sorted_filter_hash}"
  // Example: "cars:list:available=true&location=NYC"
  
  // Relationship
  relationship: (parent: string, parentId: string, child: string) => string;
  // "{parent}:{parentId}:{child}"
  // Example: "customer:123:bookings"
  
  // Time-based
  timeBased: (prefix: string, date: string, suffix?: string) => string;
  // "{prefix}:{date}:{suffix?}"
  // Example: "availability:2024-01-15:morning"
  
  // Search results
  search: (entity: string, query: string, filters?: Record<string, any>) => string;
  // "search:{entity}:{query_hash}:{filter_hash?}"
  // Example: "search:cars:luxury:location=NYC"
}
```

### Performance Thresholds

```yaml
performance_thresholds:
  response_times:
    excellent: < 50ms
    good: < 100ms
    acceptable: < 200ms
    needs_optimization: < 500ms
    critical: > 500ms
  
  cache_hit_rates:
    excellent: > 90%
    good: > 80%
    acceptable: > 70%
    needs_improvement: > 60%
    critical: < 60%
  
  query_complexity:
    simple: 
      - "Single table"
      - "Uses primary key or single index"
      - "No aggregations"
    moderate:
      - "1-2 joins"
      - "Uses composite indexes"
      - "Simple aggregations"
    complex:
      - "3+ joins"
      - "Subqueries"
      - "Window functions"
      - "Complex aggregations"
```

### Agent Decision Examples

```yaml
# Example 1: Optimizing a slow customer bookings query
input:
  query_type: "customer booking history"
  current_performance: "500ms"
  
agent_analysis:
  - check: "Is there a composite index on (customer_id, created_at)?"
    result: "No"
    action: "Create index idx_bookings_customer_history"
  
  - check: "Is the result cacheable?"
    result: "Yes, with 5-minute TTL"
    action: "Implement cache with key pattern customer:{id}:bookings"
  
  - check: "Can we reduce data fetched?"
    result: "Yes, pagination not implemented"
    action: "Add LIMIT and OFFSET, fetch only required fields"

# Example 2: Implementing new feature requiring database changes
input:
  feature: "Wishlist functionality"
  requirements: "Users can save cars to wishlist"
  
agent_analysis:
  - decision: "New table or extend existing?"
    factors:
      - "One-to-many relationship (user to cars)"
      - "Needs timestamp tracking"
      - "May need additional metadata"
    recommendation: "Create new wishlists table"
  
  - schema:
      table_name: "wishlists"
      columns:
        - "id: UUID PRIMARY KEY"
        - "customer_id: UUID REFERENCES customers(id)"
        - "car_id: UUID REFERENCES cars(id)"
        - "created_at: TIMESTAMPTZ"
        - "notes: TEXT"
      indexes:
        - "UNIQUE(customer_id, car_id)"
        - "INDEX(customer_id, created_at DESC)"
      
  - caching_strategy:
      pattern: "cache-aside"
      key: "customer:{customer_id}:wishlist"
      ttl: 900  # 15 minutes
      invalidation: "On add/remove from wishlist"
```

### Migration Safety Checklist

```yaml
migration_checklist:
  pre_deployment:
    - "Run EXPLAIN on affected queries"
    - "Test on copy of production data"
    - "Ensure indexes created CONCURRENTLY"
    - "Have rollback script ready"
    - "Schedule during low-traffic period"
  
  deployment:
    - "Monitor active connections"
    - "Watch for lock conflicts"
    - "Check query performance metrics"
    - "Verify cache behavior"
  
  post_deployment:
    - "Confirm index usage"
    - "Check for performance regression"
    - "Monitor error rates"
    - "Validate cache hit rates"
```

---

## Appendix

### A. Useful Queries

```sql
-- Find missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;

-- Identify unused indexes
SELECT 
  schemaname || '.' || tablename as table,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Table sizes and bloat
SELECT
  schemaname || '.' || tablename as table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### B. Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=100
DATABASE_STATEMENT_TIMEOUT=30000

# Redis Configuration  
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx
REDIS_CACHE_TTL_DEFAULT=3600
REDIS_CACHE_TTL_SHORT=300

# Monitoring
ENABLE_QUERY_LOGGING=true
SLOW_QUERY_THRESHOLD_MS=100
CACHE_METRICS_ENABLED=true
```

### C. References

1. [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
2. [Supabase Performance Guide](https://supabase.com/docs/guides/performance)
3. [Redis Best Practices](https://redis.io/docs/manual/patterns/)
4. [Database Indexing Strategies](https://use-the-index-luke.com/)

---

## Document Version

- **Version**: 1.0.0
- **Last Updated**: 2024-01-15
- **Next Review**: 2024-02-15
- **Owner**: Engineering Team
- **Status**: Active

### Change Log
| Date | Version | Changes | Author |
|------|---------|---------|---------|
| 2024-01-15 | 1.0.0 | Initial comprehensive plan | System |