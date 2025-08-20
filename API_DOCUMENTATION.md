# ExoDrive API Documentation

## Overview

This document provides comprehensive documentation for the ExoDrive API, including all endpoints, request/response formats, headers, error handling, and rate limiting information.

**Last Updated**: January 23, 2025

## Base URL

```
Production: https://exodrive.com/api
Development: http://localhost:3005/api
```

## Authentication

### Public Endpoints
Most car browsing and availability endpoints are public and don't require authentication.

### Admin Endpoints
Admin endpoints require authentication via Supabase Auth. Include the authorization header:
```
Authorization: Bearer {your-jwt-token}
```

### Customer Secure Pages
Customer-specific pages use secure tokens in the URL path:
```
/booking/{bookingId}/token/{secureToken}
```

## Common Response Headers

All API responses include the following headers:

### Cache Headers
- `X-Cache`: Indicates cache status (`HIT` or `MISS`)
- `Cache-Control`: Cache directives for the response

### Rate Limit Headers
- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: ISO 8601 timestamp when the limit resets

### Debug Headers
- `X-Trace-Id`: Unique identifier for request tracing

## Error Response Format

All errors follow a standardized format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional context (optional)
    },
    "timestamp": "2025-01-22T10:00:00.000Z",
    "traceId": "unique-trace-id"
  },
  "status": 400
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_REQUEST` | 400 | Malformed request |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `CACHE_ERROR` | 500 | Cache operation failed |
| `EXTERNAL_SERVICE_ERROR` | 502 | External service error |

## Rate Limiting

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Public endpoints | 60 requests | 1 minute |
| Authenticated endpoints | 120 requests | 1 minute |
| Booking creation | 10 requests | 1 hour |
| Admin endpoints | 300 requests | 1 minute |

### Rate Limit Response

When rate limited, the API returns:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests, please try again later",
    "details": {
      "retryAfter": 30
    },
    "timestamp": "2025-01-22T10:00:00.000Z",
    "traceId": "abc123"
  },
  "status": 429
}
```

Headers:
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-01-22T10:01:00.000Z
Retry-After: 30
```

## API Endpoints

### Cars

#### List Cars
```http
GET /api/cars
```

Get a list of all available cars.

**Response Headers:**
- `X-Cache`: Usually `HIT` (1 hour TTL)

**Response:**
```json
{
  "cars": [
    {
      "id": "uuid",
      "model": "Ferrari 488 GTB",
      "make": "Ferrari",
      "year": 2023,
      "daily_rate": 1500,
      "features": ["GPS", "Bluetooth", "Leather Seats"],
      "images": ["url1", "url2"],
      "is_available": true
    }
  ]
}
```

#### Get Car Details
```http
GET /api/cars/{carId}
```

Get detailed information about a specific car.

**Response Headers:**
- `X-Cache`: Usually `HIT` (30 minute TTL)

**Response:**
```json
{
  "id": "uuid",
  "model": "Ferrari 488 GTB",
  "make": "Ferrari",
  "year": 2023,
  "daily_rate": 1500,
  "description": "Luxury sports car...",
  "features": ["GPS", "Bluetooth", "Leather Seats"],
  "specifications": {
    "engine": "3.9L V8",
    "horsepower": 661,
    "transmission": "7-speed dual-clutch"
  },
  "images": ["url1", "url2"],
  "is_available": true
}
```

#### Check Car Availability
```http
GET /api/cars/availability?carId={id}&start={date}&end={date}
```

Check if a car is available for specific dates.

**Query Parameters:**
- `carId` (required): UUID of the car
- `start` (required): Start date (YYYY-MM-DD)
- `end` (required): End date (YYYY-MM-DD)

**Response Headers:**
- `X-Cache`: Usually `HIT` (5 minute TTL)

**Response:**
```json
{
  "available": true,
  "unavailableDates": ["2025-01-25", "2025-01-26"],
  "summary": {
    "total": 7,
    "available": 5,
    "booked": 2
  }
}
```

### Bookings

#### Create Booking
```http
POST /api/bookings
```

Create a new booking.

**Rate Limit:** 10 requests per hour

**Request Body:**
```json
{
  "carId": "uuid",
  "startDate": "2025-02-01",
  "endDate": "2025-02-05",
  "customerDetails": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

**Response:**
```json
{
  "bookingId": "uuid",
  "bookingUrl": "https://exodrive.com/booking/uuid/token/secure-token",
  "success": true
}
```

#### Create PayPal Order (Server-Side Pricing)
```http
POST /api/bookings/create-paypal-order
```

Create a PayPal order with server-calculated pricing.

**Rate Limit:** 30 requests per hour

**Security Note:** Price is calculated server-side based on database pricing rules. Client cannot manipulate the rental price.

**Request Body:**
```json
{
  "carId": "uuid",
  "startDate": "2025-02-01",
  "endDate": "2025-02-05",
  "bookingId": "temp-booking-123",
  "description": "Ferrari 488 GTB rental Feb 1-5"
}
```

**Response:**
```json
{
  "orderID": "PAYPAL-ORDER-ID-123"
}
```

**Error Response (Price Calculation Failed):**
```json
{
  "error": "Failed to calculate price",
  "details": "Minimum rental period is 3 days"
}
```

#### Authorize PayPal Order (Price Validation)
```http
POST /api/bookings/authorize-paypal-order
```

Authorize a PayPal payment and create the booking.

**Rate Limit:** 30 requests per hour

**Security Note:** Server validates the client-provided price against server calculation. Any mismatch is logged as a potential security event.

**Request Body:**
```json
{
  "orderID": "PAYPAL-ORDER-ID-123",
  "bookingDetails": {
    "carId": "uuid",
    "startDate": "2025-02-01",
    "endDate": "2025-02-05",
    "totalPrice": 4500,
    "customer": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "bookingId": "uuid",
  "authorizationId": "PAYPAL-AUTH-ID-456"
}
```

**Error Response (Price Validation Failed):**
```json
{
  "error": "Price validation failed",
  "status": 400
}
```

### Admin Endpoints

#### Cache Warming
```http
POST /api/admin/cache-warm
```

Trigger cache warming to pre-load frequently accessed data.

**Authentication:** Admin required

**Request Body (optional):**
```json
{
  "warmPopularCars": true,
  "warmUpcomingAvailability": true,
  "popularCarsLimit": 10,
  "availabilityDays": 7
}
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "startTime": "2025-01-22T10:00:00.000Z",
    "endTime": "2025-01-22T10:00:05.123Z",
    "duration": 5123,
    "keysWarmed": 47,
    "status": "success",
    "errors": []
  },
  "message": "Cache warming success. Warmed 47 keys in 5123ms."
}
```

#### Get Cache Warming Status
```http
GET /api/admin/cache-warm
```

Get the last cache warming metrics.

**Authentication:** Admin required

**Response:**
```json
{
  "metrics": {
    "startTime": "2025-01-22T10:00:00.000Z",
    "endTime": "2025-01-22T10:00:05.123Z",
    "duration": 5123,
    "keysWarmed": 47,
    "status": "success",
    "errors": []
  }
}
```

#### List Bookings
```http
GET /api/admin/bookings?status={status}&page={page}&limit={limit}
```

Get paginated list of bookings.

**Authentication:** Admin required

**Query Parameters:**
- `status` (optional): Filter by booking status
- `page` (default: 1): Page number
- `limit` (default: 20): Items per page

**Response:**
```json
{
  "bookings": [
    {
      "id": "uuid",
      "customer_name": "John Doe",
      "car_model": "Ferrari 488 GTB",
      "start_date": "2025-02-01",
      "end_date": "2025-02-05",
      "status": "upcoming",
      "total_amount": 6000
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Update Booking Status
```http
POST /api/admin/bookings/{id}/status
```

Update the status of a booking.

**Authentication:** Admin required

**Request Body:**
```json
{
  "status": "confirmed",
  "notes": "Payment verified"
}
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "status": "confirmed",
    "updated_at": "2025-01-22T10:00:00.000Z"
  }
}
```

#### Process Payment Captures (Cron Job)
```http
POST /api/admin/process-payment-captures
```

Process scheduled payment captures. This endpoint is called automatically by Vercel Cron every 15 minutes.

**Authentication:** Bearer token with CRON_SECRET

**Headers:**
```
Authorization: Bearer {CRON_SECRET}
```

**Response:**
```json
{
  "success": true,
  "processed_count": 3,
  "results": [
    {
      "booking_id": "uuid-1",
      "success": true,
      "capture_id": "PAYPAL-CAPTURE-123"
    },
    {
      "booking_id": "uuid-2",
      "success": false,
      "error": "Authorization expired"
    },
    {
      "booking_id": "uuid-3",
      "success": true,
      "capture_id": "PAYPAL-CAPTURE-456"
    }
  ]
}
```

**Manual Testing:**
```http
GET /api/admin/process-payment-captures
```

Returns information about the payment capture processor.

**Response:**
```json
{
  "message": "Payment capture processor is running",
  "info": "Use POST method with proper authorization to process captures"
}
```

### Webhook Endpoints

#### PayPal Webhook
```http
POST /api/webhooks/paypal
```

Receives PayPal webhook events.

**Authentication:** PayPal signature verification

**Events Handled:**
- `PAYMENT.AUTHORIZATION.CREATED`
- `PAYMENT.CAPTURE.COMPLETED`
- `CUSTOMER.DISPUTE.CREATED`
- `INVOICING.INVOICE.PAID`

#### DocuSeal Webhook
```http
POST /api/webhooks/docuseal
```

Receives DocuSeal webhook events.

**Authentication:** DocuSeal signature verification

**Events Handled:**
- `form.viewed`
- `form.started`
- `form.completed`
- `form.declined`

#### Resend Webhook
```http
POST /api/webhooks/resend
```

Receives Resend webhook events.

**Authentication:** Resend signature verification

**Events Handled:**
- `email.sent`
- `email.delivered`
- `email.opened`
- `email.bounced`

## Performance Optimization

### Caching Strategy

| Endpoint | Cache TTL | Cache Key Pattern |
|----------|-----------|-------------------|
| Car List | 1 hour | `fleet:all` |
| Car Details | 30 minutes | `car:{carId}` |
| Availability | 5 minutes | `availability:{carId}:{startDate}:{endDate}` |

### Cache Invalidation

Cache is automatically invalidated when:
- A booking is created or cancelled (availability cache)
- Car details are updated (car cache)
- Fleet changes occur (fleet cache)

## Best Practices

### Request Optimization
1. Use caching headers to avoid unnecessary requests
2. Batch related requests when possible
3. Implement exponential backoff for retries

### Error Handling
1. Always check the error code, not just the status
2. Use the trace ID for debugging with support
3. Implement proper retry logic for 5xx errors

### Rate Limiting
1. Monitor rate limit headers proactively
2. Implement client-side rate limiting
3. Use webhooks instead of polling when possible

## SDK Examples

### JavaScript/TypeScript
```typescript
const response = await fetch('https://exodrive.com/api/cars/availability?' + 
  new URLSearchParams({
    carId: 'uuid',
    start: '2025-02-01',
    end: '2025-02-05'
  }), {
    headers: {
      'Accept': 'application/json'
    }
  });

if (!response.ok) {
  const error = await response.json();
  console.error(`Error ${error.error.code}: ${error.error.message}`);
  console.error(`Trace ID: ${error.error.traceId}`);
}

const data = await response.json();
console.log(`Cache status: ${response.headers.get('X-Cache')}`);
```

### cURL
```bash
# Check availability
curl -i "https://exodrive.com/api/cars/availability?carId=uuid&start=2025-02-01&end=2025-02-05"

# Create booking
curl -X POST https://exodrive.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "carId": "uuid",
    "startDate": "2025-02-01",
    "endDate": "2025-02-05",
    "customerDetails": {
      "fullName": "John Doe",
      "email": "john@example.com"
    }
  }'
```

## Security Features

### Server-Side Pricing

All pricing calculations are performed server-side to prevent manipulation:

1. **Price Calculation**: Database functions calculate prices based on:
   - Base daily rate from `car_pricing` table
   - Number of rental days
   - Applicable discounts
   - Minimum rental period validation

2. **Price Validation**: Server validates any client-provided prices:
   - Compares against server calculation
   - Logs mismatches as security events
   - Rejects requests with invalid prices

3. **Audit Trail**: All price calculations are logged with:
   - Timestamp
   - Input parameters
   - Calculation result
   - User/session information

#### Database Functions

##### `calculate_booking_price`

Calculates booking price server-side with comprehensive pricing logic.

**Purpose**: Provides secure, server-side price calculation for rental bookings

**Parameters**:
- `p_car_id` (UUID): The car ID to calculate pricing for
- `p_start_date` (DATE): Rental start date
- `p_end_date` (DATE): Rental end date

**Returns**: JSONB object containing:
```json
{
  "success": true,
  "base_price": 1500.00,
  "days": 4,
  "subtotal": 6000.00,
  "deposit_amount": 3000.00,
  "final_price": 9000.00
}
```

**Security**: 
- Function uses `SECURITY DEFINER` 
- Accessible by: `authenticated`, `service_role`, and `anon` roles
- All calculations performed server-side to prevent client manipulation

**Usage Example**:
```sql
SELECT calculate_booking_price(
  'car-uuid-here'::uuid,
  '2025-02-01'::date,
  '2025-02-05'::date
);
```

##### `validate_booking_price`

Validates client-provided prices against server calculations for security.

**Purpose**: Ensures price integrity by comparing client prices with server calculations

**Parameters**:
- `p_car_id` (UUID): The car ID to validate pricing for
- `p_start_date` (DATE): Rental start date
- `p_end_date` (DATE): Rental end date
- `p_client_price` (NUMERIC): Client-provided price to validate

**Returns**: JSONB object containing:
```json
{
  "valid": true,
  "server_calculation": {
    "success": true,
    "final_price": 9000.00,
    "base_price": 1500.00,
    "days": 4
  }
}
```

Or when validation fails:
```json
{
  "valid": false,
  "error": "Price mismatch detected",
  "client_price": 8000.00,
  "server_price": 9000.00,
  "server_calculation": {
    "success": true,
    "final_price": 9000.00
  }
}
```

**Security**: 
- Function uses `SECURITY DEFINER`
- Accessible by: `authenticated` and `service_role` roles only (NOT `anon`)
- Price mismatches are logged as potential security events
- Prevents price manipulation attacks

**Usage Example**:
```sql
SELECT validate_booking_price(
  'car-uuid-here'::uuid,
  '2025-02-01'::date,
  '2025-02-05'::date,
  9000.00
);
```

### Automatic Payment Capture

Payments are automatically captured based on configurable rules:

1. **Capture Rules**:
   - After contract signing
   - X hours before rental start
   - Upon admin approval
   - Immediately (for trusted customers)

2. **Processing**:
   - Cron job runs every 15 minutes
   - Processes bookings with scheduled captures
   - Handles failures with retry logic
   - Updates booking status automatically

3. **Monitoring**:
   - Track capture success rates
   - Alert on repeated failures
   - Log all capture attempts

## Migration Guide

### From v2 to v2.5 (Security Update)

#### Breaking Changes
1. **PayPal Order Creation** - Must now send car ID and dates instead of price
2. **Price Validation** - Server validates all prices, manipulation attempts blocked
3. **New Environment Variable** - `CRON_SECRET` required for payment capture

#### New Features
1. Server-side pricing calculations
2. Automatic payment capture system
3. Price manipulation detection
4. Enhanced security logging

### From v1 to v2

#### Breaking Changes
1. Error response format has changed - update error handling
2. Rate limit headers are now standard - monitor them
3. Cache headers added - use for optimization

#### New Features
1. Trace IDs for debugging
2. Cache warming endpoints
3. Standardized error codes
4. Rate limiting on all endpoints

## Support

For API support:
- Check trace IDs in error responses
- Contact: api-support@exodrive.com
- Documentation: https://docs.exodrive.com