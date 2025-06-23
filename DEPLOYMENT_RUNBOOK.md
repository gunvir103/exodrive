# 📘 Deployment Runbook - ExoDrive

**Version**: 2.0  
**Last Updated**: January 23, 2025  
**Service**: ExoDrive Production Deployment  

## 🎯 Deployment Overview

This runbook provides step-by-step instructions for deploying ExoDrive to production, including:
- Redis caching implementation
- Server-side pricing security
- Automatic payment capture system
- Pre-deployment checks, deployment steps, validation, and rollback procedures.

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

# Apply existing migrations in order
\i supabase/migrations/20250623_add_critical_performance_indexes.sql
\i supabase/migrations/20250623_add_webhook_retries.sql
\i supabase/migrations/20250624000000_fix_booking_race_condition.sql

# Apply security migrations (already applied via Supabase dashboard)
# These migrations create:
# - Server-side pricing functions (calculate_booking_price, validate_booking_price)
# - Payment capture rules table
# - Automatic capture functions and triggers

# Verify migrations
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;

# Verify security functions exist
SELECT proname FROM pg_proc WHERE proname IN ('calculate_booking_price', 'validate_booking_price', 'process_scheduled_payment_captures');
```

### Step 2: Update Environment Variables
```bash
# Redis Configuration
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add KV_URL production
vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production

# Security Configuration
vercel env add CRON_SECRET production  # For payment capture cron job

# Verify all required variables
vercel env ls production | grep -E "(REDIS|KV|CRON_SECRET|PAYPAL)"

# Ensure PayPal is in production mode
vercel env add PAYPAL_MODE production  # Should be 'live' not 'sandbox'
```

### Step 3: Update Vercel Configuration
```bash
# Verify vercel.json includes payment capture cron
cat vercel.json | grep "process-payment-captures"

# Expected output:
# "path": "/api/admin/process-payment-captures",
# "schedule": "*/15 * * * *"
```

### Step 4: Deploy Application
```bash
# Build and deploy
bun run build
vercel deploy --prod

# Get deployment URL
DEPLOYMENT_URL=$(vercel ls --prod | grep "Production" | awk '{print $2}')
echo "Deployed to: $DEPLOYMENT_URL"

# Verify cron jobs are active
vercel cron ls
```

### Step 5: Warm Cache (Optional but Recommended)
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

### 1. Security Validation
```bash
# Test server-side pricing
curl -X POST https://api.exodrive.com/api/bookings/create-paypal-order \
  -H "Content-Type: application/json" \
  -d '{
    "carId": "test-car-id",
    "startDate": "2025-02-01",
    "endDate": "2025-02-05",
    "bookingId": "test-123"
  }'

# Verify price manipulation is blocked
# The endpoint should calculate price server-side, not accept client price

# Test payment capture cron manually
curl -X GET https://api.exodrive.com/api/admin/process-payment-captures

# Expected: "Payment capture processor is running"
```

### 2. Health Checks
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

# If only Redis needs to be disabled
vercel env add DISABLE_REDIS true production
vercel redeploy

# If payment capture needs to be disabled
# Remove cron job from vercel.json and redeploy
```

### Full Rollback
```bash
# 1. Revert code deployment
git revert HEAD
git push origin main

# 2. Revert database changes (if absolutely necessary)
# NOTE: Security functions should remain even if not used
psql $DATABASE_URL << EOF
-- Disable payment capture triggers (keep functions)
DROP TRIGGER IF EXISTS booking_confirmation_payment_capture ON bookings;
DROP TRIGGER IF EXISTS booking_creation_payment_capture ON bookings;

-- Revert booking columns (optional)
ALTER TABLE bookings 
DROP COLUMN IF EXISTS payment_capture_scheduled_at,
DROP COLUMN IF EXISTS payment_capture_attempted_at,
DROP COLUMN IF EXISTS payment_capture_rule_id;

-- Keep pricing functions for security
-- DO NOT DROP calculate_booking_price or validate_booking_price
EOF

# 3. Clear Redis cache
curl -X POST https://api.exodrive.com/api/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Remove cron secret
vercel env rm CRON_SECRET production

# 5. Redeploy previous version
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

5. **Security Metrics**
   - Price validation failures: Alert on > 5 per hour
   - Payment capture success rate: Alert on < 95%
   - Failed capture retries: Alert on > 10 per hour

6. **Cron Job Health**
   - Monitor: Payment capture cron execution
   - Alert: If cron hasn't run in 30 minutes

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

## 🔐 Security Deployment Checklist

### Pre-Deployment Security Verification
- [ ] Verify CRON_SECRET is set in production
- [ ] Confirm PayPal is in production mode
- [ ] Database functions have proper search_path set
- [ ] RLS enabled on payment_capture_rules table

### Post-Deployment Security Testing
- [ ] Test price manipulation is blocked
- [ ] Verify server-side calculations work
- [ ] Confirm payment capture cron is active
- [ ] Check audit logging is functioning

### Security Monitoring Setup
- [ ] Price validation failure alerts configured
- [ ] Payment capture success rate monitoring
- [ ] Suspicious activity detection enabled
- [ ] Audit log retention verified

## 📊 Success Criteria

### Immediate (First Hour)
- [ ] All health checks passing
- [ ] Response times < 100ms for cached endpoints
- [ ] No increase in error rates
- [ ] Rate limiting functioning correctly
- [ ] Server-side pricing working correctly
- [ ] Payment capture cron executing

### Short-term (First 24 Hours)
- [ ] Cache hit rate > 85%
- [ ] No Redis connection failures
- [ ] No customer complaints
- [ ] Database load reduced by > 50%
- [ ] No price manipulation attempts detected
- [ ] Payment captures processing successfully

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