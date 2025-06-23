# 📘 Redis Deployment Runbook - ExoDrive

**Version**: 1.0  
**Last Updated**: January 23, 2025  
**Service**: ExoDrive Redis Implementation  

## 🎯 Deployment Overview

This runbook provides step-by-step instructions for deploying the Redis implementation to production, including pre-deployment checks, deployment steps, validation, and rollback procedures.

## 📋 Pre-Deployment Checklist

### 1. Environment Verification
```bash
# Verify Redis connectivity
curl -X GET https://api.exodrive.com/api/demo/redis \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected response:
{
  "redis": {
    "connected": true,
    "latency_ms": <100
  }
}
```

### 2. Backup Current State
```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Document current performance metrics
curl https://api.exodrive.com/api/admin/metrics > metrics_before.json
```

### 3. Team Notifications
- [ ] Notify development team
- [ ] Notify support team
- [ ] Update status page
- [ ] Prepare incident response team

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations
```bash
# Connect to production database
psql $DATABASE_URL

# Apply migrations in order
\i supabase/migrations/20250623_add_critical_performance_indexes.sql
\i supabase/migrations/20250623_add_webhook_retries.sql
\i supabase/migrations/20250624000000_fix_booking_race_condition.sql

# Verify migrations
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 3;
```

### Step 2: Update Environment Variables
```bash
# Vercel CLI
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add KV_URL production
vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production

# Verify
vercel env ls production | grep -E "(REDIS|KV)"
```

### Step 3: Deploy Application
```bash
# Build and deploy
bun run build
vercel deploy --prod

# Get deployment URL
DEPLOYMENT_URL=$(vercel ls --prod | grep "Production" | awk '{print $2}')
echo "Deployed to: $DEPLOYMENT_URL"
```

### Step 4: Warm Cache (Optional but Recommended)
```bash
# Warm popular cars and availability
curl -X POST https://api.exodrive.com/api/admin/cache-warm \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "warmPopularCars": true,
    "warmUpcomingAvailability": true,
    "popularCarsLimit": 20,
    "availabilityDays": 14
  }'
```

## ✅ Post-Deployment Validation

### 1. Health Checks
```bash
# Redis connectivity
curl https://api.exodrive.com/api/demo/redis

# Rate limiting
for i in {1..5}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://api.exodrive.com/api/cars
done
# Should see 429 after limit exceeded

# Cache performance
time curl https://api.exodrive.com/api/cars
# Should be < 100ms

# Check cache headers
curl -I https://api.exodrive.com/api/cars | grep -E "X-Cache|X-Response-Time"
```

### 2. Monitoring Checks
```bash
# Run performance monitor
bunx scripts/redis-performance-monitor.ts --generate-report

# Check rate limit violations
curl https://api.exodrive.com/api/admin/rate-limit-monitoring \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify error rates
curl https://api.exodrive.com/api/admin/metrics/errors \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3. Functional Testing
```bash
# Test car listing (should be cached)
curl https://api.exodrive.com/api/cars?page=1&limit=10

# Test car availability (should use Redis)
curl "https://api.exodrive.com/api/cars/availability?carId=123&startDate=2025-02-01&endDate=2025-02-05"

# Test booking creation (should use Redis locks)
curl -X POST https://api.exodrive.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"carId": "123", "startDate": "2025-02-01", "endDate": "2025-02-05"}'
```

## 🔄 Rollback Procedure

### Immediate Rollback (< 5 minutes)
```bash
# Revert to previous deployment
vercel rollback

# Disable Redis (feature flag)
vercel env add DISABLE_REDIS true production
vercel redeploy
```

### Full Rollback
```bash
# 1. Revert code deployment
git revert HEAD
git push origin main

# 2. Revert database migrations
psql $DATABASE_URL << EOF
-- Revert booking race condition fix
DROP INDEX IF EXISTS idx_bookings_unique_active;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_booking;

-- Revert performance indexes
DROP INDEX IF EXISTS idx_bookings_status;
DROP INDEX IF EXISTS idx_bookings_car_status_dates;
-- ... (other index drops)
EOF

# 3. Clear Redis cache
curl -X POST https://api.exodrive.com/api/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Redeploy previous version
vercel deploy --prod
```

## 🚨 Monitoring & Alerts

### Key Metrics to Monitor
1. **Response Times**
   - Threshold: p95 < 100ms
   - Alert: p95 > 200ms for 5 minutes

2. **Cache Hit Rate**
   - Target: > 85%
   - Alert: < 70% for 10 minutes

3. **Redis Connectivity**
   - Check: Every 1 minute
   - Alert: Connection failure

4. **Error Rates**
   - Baseline: < 0.1%
   - Alert: > 1% for 5 minutes

### Alert Responses

#### High Response Time
```bash
# 1. Check Redis status
bunx scripts/redis-performance-monitor.ts

# 2. Check cache hit rates
curl https://api.exodrive.com/api/admin/metrics/cache

# 3. Consider cache warming
bunx scripts/warm-cache.ts --emergency
```

#### Redis Connection Failure
```bash
# 1. Verify Redis is accessible
redis-cli -u $UPSTASH_REDIS_REST_URL ping

# 2. Check Upstash status
curl https://status.upstash.com/api/v2/status.json

# 3. Enable bypass mode if needed
vercel env add REDIS_BYPASS true production
vercel redeploy
```

#### Rate Limit Spike
```bash
# 1. Check violation patterns
curl https://api.exodrive.com/api/admin/rate-limit-monitoring?minutes=10

# 2. Identify abusive IPs
bunx scripts/monitor-rate-limits.ts --analyze

# 3. Consider temporary blocks
# Add to Vercel Edge Config or WAF
```

## 📊 Success Criteria

### Immediate (First Hour)
- [ ] All health checks passing
- [ ] Response times < 100ms for cached endpoints
- [ ] No increase in error rates
- [ ] Rate limiting functioning correctly

### Short-term (First 24 Hours)
- [ ] Cache hit rate > 85%
- [ ] No Redis connection failures
- [ ] No customer complaints
- [ ] Database load reduced by > 50%

### Long-term (First Week)
- [ ] Sustained performance improvements
- [ ] No memory issues in Redis
- [ ] Successful handling of peak traffic
- [ ] Cost savings from reduced database usage

## 📞 Escalation Path

### Level 1: Development Team
- Response time: 15 minutes
- Issues: Configuration, minor bugs
- Contact: dev-oncall@exodrive.com

### Level 2: Infrastructure Team
- Response time: 30 minutes
- Issues: Redis failures, performance degradation
- Contact: infra-oncall@exodrive.com

### Level 3: Senior Leadership
- Response time: 1 hour
- Issues: Major outage, data loss risk
- Contact: cto@exodrive.com

## 📝 Post-Deployment Tasks

### Within 24 Hours
- [ ] Review performance metrics
- [ ] Analyze cache hit patterns
- [ ] Document any issues encountered
- [ ] Update runbook with learnings

### Within 1 Week
- [ ] Optimize cache TTL values based on usage
- [ ] Review rate limit configurations
- [ ] Plan for Redis cluster if needed
- [ ] Schedule team retrospective

### Within 1 Month
- [ ] Full performance analysis report
- [ ] Cost-benefit analysis
- [ ] Plan next optimization phase
- [ ] Update disaster recovery procedures

## 🔧 Troubleshooting Guide

### Common Issues

#### Issue: Low Cache Hit Rate
```bash
# Diagnose
curl https://api.exodrive.com/api/admin/metrics/cache/analysis

# Solutions:
1. Increase TTL for stable data
2. Implement cache warming for popular items
3. Review cache key generation logic
```

#### Issue: Redis Memory Pressure
```bash
# Check memory usage
redis-cli -u $UPSTASH_REDIS_REST_URL info memory

# Solutions:
1. Reduce TTL values
2. Implement LRU eviction
3. Upgrade Redis plan
```

#### Issue: Rate Limit False Positives
```bash
# Review recent violations
bunx scripts/monitor-rate-limits.ts --last-hour

# Solutions:
1. Adjust rate limit thresholds
2. Implement IP whitelist for partners
3. Add user-based limits for authenticated requests
```

---

**Remember**: Always prefer gradual rollout and monitoring over big-bang deployments. This implementation includes graceful degradation, so the service will continue to function even if Redis becomes unavailable.