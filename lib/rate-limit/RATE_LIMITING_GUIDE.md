# Rate Limiting Implementation Guide

## Overview

This guide explains the enhanced rate limiting implementation for ExoDrive, which includes:
- Stricter limits for payment endpoints
- Per-user rate limiting in addition to per-IP
- Monitoring and alerting for rate limit violations
- Proper rate limit headers

## Rate Limits

### Payment Endpoints
- **Limit**: 10 requests per minute per IP
- **Dual limiting**: Also enforces per-user limits when authenticated
- **Endpoints**:
  - `/api/bookings/create-paypal-order`
  - `/api/bookings/capture-paypal-payment`
  - `/api/bookings/[bookingId]/capture-payment`

### Upload Endpoints
- **Limit**: 5 requests per minute per user
- **Fallback**: IP-based limiting for unauthenticated requests
- **Endpoints**:
  - `/api/cars/upload`

### Webhook Endpoints
- **Limit**: 100 requests per minute per IP
- **Endpoints**:
  - `/api/webhooks/paypal`
  - `/api/webhooks/docuseal`
  - `/api/webhooks/resend`

### Admin Endpoints
- **Limit**: 300 requests per minute per user
- **Requirement**: Authentication required
- **Endpoints**:
  - `/api/admin/*`

## Implementation

### 1. Import Rate Limit Middleware

```typescript
import { paymentRateLimit, uploadRateLimit, webhookRateLimit, adminRateLimit } from '@/lib/rate-limit';
```

### 2. Apply to Endpoints

#### Payment Endpoint Example
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { paymentRateLimit } from '@/lib/rate-limit';

export const POST = paymentRateLimit(async (request: NextRequest) => {
  // Your payment processing logic
  return NextResponse.json({ success: true });
});
```

#### Upload Endpoint Example
```typescript
import { uploadRateLimit } from '@/lib/rate-limit';

export const POST = uploadRateLimit(async (request: NextRequest) => {
  // Your upload logic
  return NextResponse.json({ success: true });
});
```

### 3. Custom Rate Limiting

For custom rate limits, use the `withRateLimit` function:

```typescript
import { withRateLimit } from '@/lib/rate-limit';

const customRateLimit = withRateLimit(handler, {
  config: {
    windowMs: 300000, // 5 minutes
    max: 10,
    keyGenerator: (id) => `custom:${id}`,
  },
  identifierExtractor: (req) => getClientIp(req),
});
```

## Rate Limit Headers

All rate-limited endpoints automatically include these headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: ISO timestamp when the limit resets
- `Retry-After`: Seconds to wait before retry (only when rate limited)

## Monitoring

### Rate Limit Violations

Access the monitoring endpoint to view violations:

```bash
GET /api/admin/rate-limit-monitoring?minutes=60
```

Response includes:
- Total violations
- Unique identifiers affected
- Violations by endpoint
- Recent violation details

### Clear Violations

```bash
DELETE /api/admin/rate-limit-monitoring
```

## Testing Rate Limits

Use the testing utilities:

```typescript
import { testRateLimit, getRateLimitStatus } from '@/lib/rate-limit/rate-limit-testing';

// Test rate limit behavior
const result = await testRateLimit('test-ip', config, 20);
console.log(`Allowed: ${result.allowed}, Blocked: ${result.blocked}`);

// Check current status
const status = await getRateLimitStatus('user123', config);
console.log(`Remaining: ${status.remaining}/${status.limit}`);
```

## Best Practices

1. **Always apply rate limiting** to:
   - Payment processing endpoints
   - File upload endpoints
   - External webhook receivers
   - Resource-intensive operations

2. **Use dual limiting** for critical endpoints:
   - Combines IP and user-based limits
   - Provides better protection against abuse

3. **Monitor violations regularly**:
   - Check the monitoring endpoint
   - Set up alerts for repeated violations
   - Adjust limits based on legitimate usage patterns

4. **Handle rate limit errors gracefully**:
   - Show clear error messages to users
   - Include retry information
   - Implement exponential backoff in clients

## Error Handling

When rate limited, endpoints will return:
```json
{
  "error": "Too many requests",
  "retryAfter": 45
}
```

Status code: 429 (Too Many Requests)

## Environment-Specific Configuration

Rate limits can be adjusted per environment in the config files. Consider:
- Higher limits for development/staging
- Stricter limits for production
- Special allowlists for trusted IPs/users