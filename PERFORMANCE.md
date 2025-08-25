# Performance Optimization Guide

## Overview

ExoDrive uses a multi-layered caching strategy with Redis to achieve sub-50ms response times for most API calls.

## Caching Architecture

### Cache Layers
1. **Redis Cache** (Primary): Upstash Redis for distributed caching
2. **Database Query Cache**: Supabase connection pooling
3. **CDN Cache**: Static assets via Vercel Edge Network

### Cache Strategy
- **Pattern**: Cache-aside with automatic invalidation
- **TTL Management**:
  - Car listings: 1 hour
  - Car details: 30 minutes
  - Availability: 5 minutes
  - Reviews: 1 hour
  - PayPal tokens: 8 hours

### Cache Keys Structure
```
cars:list:{page}:{limit}:{filters}
cars:details:{carId}
cars:availability:{carId}:{startDate}:{endDate}
cars:reviews:{carId}:{page}:{limit}
```

## Performance Metrics

### Target Response Times
- Cached requests: <50ms
- Database queries: <250ms
- Search operations: <500ms
- File uploads: <2s

### Current Performance
- Average response time: 45ms (cached), 180ms (uncached)
- Cache hit rate: 87%
- Database connection pool: 20 connections
- Concurrent request handling: 1000+ req/s

## Optimization Techniques

### Database Optimizations
```sql
-- Critical indexes added
CREATE INDEX idx_car_availability_lookup ON car_availability(car_id, date);
CREATE INDEX idx_bookings_conflicts ON bookings(car_id, start_date, end_date);
CREATE INDEX idx_bookings_customer ON bookings(customer_id, created_at);
CREATE INDEX idx_reviews_listing ON car_reviews(car_id, is_approved, created_at);
```

### API Optimizations
1. **Parallel Processing**: Use Promise.all for independent operations
2. **Lazy Loading**: Pagination on all list endpoints
3. **Field Selection**: Only query required fields
4. **Connection Pooling**: Reuse database connections

### Caching Best Practices
1. **Cache Warming**: Available via admin API and CLI script
2. **Invalidation Strategy**: Tag-based invalidation
3. **Graceful Degradation**: Falls back to database if Redis unavailable
4. **Stale-While-Revalidate**: Serves stale data while refreshing

## Cache Warming

### Admin API
```bash
POST /api/admin/cache-warm
{
  "cars": true,
  "availability": true,
  "fleetCounts": true
}
```

### CLI Script
```bash
bunx scripts/warm-cache.ts
```

### Automatic Warming
- On application startup (optional)
- After bulk updates
- Scheduled daily at 3 AM

## Monitoring

### Performance Headers
- `X-Cache`: HIT/MISS/BYPASS
- `X-Cache-TTL`: Remaining TTL in seconds
- `X-Response-Time`: Total response time
- `X-DB-Time`: Database query time

### Metrics to Track
- Cache hit ratio (target: >85%)
- Response time percentiles (p50, p95, p99)
- Database connection pool usage
- Redis memory usage
- Error rates by endpoint

## Troubleshooting

### Common Issues

1. **Low Cache Hit Rate**
   - Check cache key generation
   - Verify TTL settings
   - Monitor cache evictions

2. **Slow Database Queries**
   - Check query execution plans
   - Verify indexes are used
   - Monitor connection pool saturation

3. **Redis Connection Issues**
   - Check connection limits
   - Monitor network latency
   - Verify Redis memory usage

### Performance Testing
```bash
# Load testing with k6
k6 run tests/load/performance.js

# Stress testing
bun run test:stress

# Cache performance
bun run test:cache
```

## Future Optimizations

1. **Read Replicas**: For heavy read operations
2. **Query Result Caching**: Cache complex aggregations
3. **Edge Caching**: Deploy Redis to edge locations
4. **WebSocket**: Real-time availability updates
5. **GraphQL**: Reduce over-fetching