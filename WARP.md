# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

ExoDrive is a luxury car rental platform built with Next.js 15, featuring automated booking management, contract generation via DocuSeal, PayPal payment processing, and comprehensive administrative tools. The platform emphasizes security, real-time updates, and automation.

## Common Development Commands

### Development
```bash
# Start development server on port 3005
bun dev

# Clean build directory
bun run clean

# Build for production
bun run build
bun start
```

### Testing
```bash
# Run all tests
bun test

# Run specific test suites
bun test:unit                  # All unit tests
bun test:integration           # All integration tests
bun test:load                  # Rate limiting tests
bun test:coverage              # Tests with coverage report

# Run specific test categories
bun test:unit:bookings         # Bookings API tests
bun test:unit:webhooks         # PayPal webhook tests
bun test:unit:availability     # Car availability tests
bun test:integration:booking-flow    # Complete booking flow
bun test:integration:cache          # Caching functionality
bun test:integration:errors         # Error handling
```

### Database Operations
```bash
# Run database migrations
bun run db:migrate

# Verify database integrity
bun run verify:db
bun run verify:db:force        # Force verification check
```

### Cache Management
```bash
# Warm cache manually
bunx scripts/warm-cache.ts

# Warm cache in background
bunx scripts/warm-cache.ts --background

# Advanced warming with metrics
bunx scripts/warm-cache-advanced.ts
```

### Webhook Management
```bash
# Process webhook retries
bun run webhook:retry

# Warm cache via webhook
bun run webhook:warm-cache
```

### Code Quality
```bash
# Run Next.js linting
bun run lint

# Format code (using Bun's built-in formatter)
bun format
```

## High-Level Architecture

### Core System Components

#### 1. **Booking System**
The booking system prevents double-booking through multi-layered concurrency control:

- **Redis Distributed Locks**: Prevent race conditions during booking creation (`lib/redis/distributed-lock.ts`)
- **Database Constraints**: `UNIQUE(car_id, date)` enforced in `car_availability` table
- **Atomic Transactions**: Supabase Edge Functions ensure transactional consistency (`supabase/functions/create-booking-transaction/`)
- **Status Management**: Complex state machine tracking booking, payment, and contract statuses independently

#### 2. **Payment Processing Architecture**
Server-side pricing with automatic payment capture:

- **Price Calculation**: All pricing logic in database functions (`calculate_booking_price()`)
- **Payment Authorization**: PayPal SDK integration for secure payment holds
- **Automatic Capture**: Cron job (`/api/admin/process-payment-captures`) runs every 15 minutes
- **Capture Rules**: Configurable timing (after contract, before rental, admin approval)
- **Security**: Server validates all client-submitted prices against calculated values

#### 3. **Contract Automation (DocuSeal)**
Self-hosted e-signature integration:

- **Template Management**: Dynamic field mapping from booking data
- **Webhook Processing**: Real-time status updates (`/api/webhooks/docuseal`)
- **Status Tracking**: `not_sent` → `sent` → `viewed` → `signed`
- **Evidence Storage**: Signed PDFs stored in Supabase Storage

#### 4. **Caching Strategy (Redis/Upstash)**
High-performance caching with graceful degradation:

- **Cache Layers**:
  - Car availability: 5-minute TTL
  - Fleet listings: 1-hour TTL  
  - Car details: 30-minute TTL
  - Reviews: 15-minute TTL
- **Invalidation**: Automatic on booking creation/cancellation
- **Warming**: Manual and automated cache warming scripts
- **Fallback**: Service continues without Redis using database

#### 5. **Error Handling System**
Standardized error responses with tracing:

- **Error Middleware**: Global error handler (`lib/errors/error-middleware.ts`)
- **API Errors**: Typed error responses with trace IDs (`lib/errors/api-error.ts`)
- **Rate Limiting**: Sliding window algorithm with Redis (`lib/rate-limit/`)
- **Graceful Degradation**: Fallbacks for all external service failures

### Key Services and Libraries

#### Core Services (`lib/services/`)
- `car-service-supabase.ts`: Car data management and operations
- `booking-service.ts`: Booking creation and management logic
- `payment-service.ts`: PayPal integration and payment processing
- `email-service.ts`: Transactional email via Resend

#### Infrastructure (`lib/`)
- `redis/`: Redis client, cache service, distributed locks
- `errors/`: Error handling, API errors, middleware
- `rate-limit/`: Rate limiting implementation
- `supabase/`: Database clients and type definitions
- `validations/`: Zod schemas for API validation

#### API Routes (`app/api/`)
- `/bookings/`: Booking creation and PayPal order management
- `/admin/`: Admin operations (bookings, payments, cache)
- `/webhooks/`: PayPal, DocuSeal, and Resend webhook handlers
- `/cars/`: Car availability and details

### Database Schema Patterns

#### Key Tables and Relationships
- `bookings` → `customers`, `cars`, `payments` (core entities)
- `car_availability`: Prevents double-booking with unique constraints
- `booking_events`: Complete audit trail
- `booking_secure_tokens`: Token-based customer access
- `disputes`: PayPal dispute tracking and evidence management

#### Important Database Functions
- `create_booking_transactional()`: Atomic booking creation
- `check_and_reserve_car_availability()`: Concurrency-safe availability check
- `calculate_booking_price()`: Server-side price calculation
- `schedule_payment_capture()`: Automatic capture scheduling

#### Row Level Security (RLS)
All tables have RLS enabled with policies for:
- Public: Read-only non-hidden car data
- Authenticated: Booking access via secure tokens
- Admin: Full CRUD access
- Service Role: Webhook and system operations

### External Service Integrations

#### PayPal
- Authorization/capture flow for payment holds
- Webhook signature verification
- Dispute management with evidence collection
- Invoice generation with attachments

#### DocuSeal (Self-Hosted)
- Template-based contract generation
- Webhook events for signing status
- PDF storage in Supabase Storage

#### Resend
- Transactional email delivery
- Webhook tracking for email events
- Inbox integration for admin dashboard

#### Redis (Upstash)
- Distributed locking for concurrency control
- High-performance caching layer
- Rate limiting with sliding windows
- Session management

## Important Security Considerations

### Implemented Security Measures
- **Server-side pricing**: All prices calculated in database, never trust client
- **Automatic payment capture**: Reduces manual intervention and fraud risk
- **Input validation**: Zod schemas on all API endpoints
- **Path traversal protection**: File upload validation
- **SQL injection prevention**: Parameterized queries throughout
- **XSS protection**: Sanitized HTML rendering
- **Rate limiting**: IP and user-based limits (60-300 req/min)
- **Webhook verification**: Signature validation for all webhooks
- **Secure tokens**: Time-limited access tokens for customers

### Environment Variables Required
Critical variables that must be set:
- `SUPABASE_SERVICE_ROLE_KEY`: Backend operations
- `PAYPAL_CLIENT_SECRET`: Payment processing
- `DOCUSEAL_API_TOKEN`: Contract automation
- `UPSTASH_REDIS_REST_TOKEN`: Caching and locks
- `RESEND_API_KEY`: Email delivery
- `CRON_SECRET`: Payment capture automation

## Testing Infrastructure

### Bun Test Framework
The project uses Bun's built-in test runner with:
- Unit tests colocated in `__tests__/` directories
- Integration tests in `tests/integration/`
- Load tests in `tests/load/`
- Comprehensive mocks in `tests/mocks/`

### Key Test Coverage Areas
- Redis infrastructure: 18 tests (singleton, health checks, retries)
- Cache service: 45 tests (operations, TTL, invalidation)
- Error handling: 33 tests (all error codes, serialization)
- Rate limiting: 27 tests (sliding window, enforcement)
- Booking flow: End-to-end integration tests
- Security: Server-side pricing validation tests

## Development Patterns

### TypeScript Strict Mode
The project enforces strict TypeScript with comprehensive type definitions:
- Database types: Auto-generated from Supabase (`lib/types/database.types.ts`)
- API responses: Standardized types (`lib/types/api-responses.ts`)
- Validation: Zod schemas for runtime validation

### Next.js App Router
Using Next.js 15 with App Router:
- Server Components by default
- Client Components marked with `"use client"`
- API routes use edge runtime where possible
- Streaming and suspense for optimal loading

### Component Library
- **shadcn/ui**: Accessible, customizable components
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Animation library
- **Lucide React**: Icon set

## Project-Specific Guidelines

### When Working with Bookings
1. Always check availability through Redis locks first
2. Use atomic database transactions
3. Update all related statuses (booking, payment, contract)
4. Create audit events for all changes
5. Invalidate relevant caches

### When Modifying Payment Logic
1. Never trust client-provided prices
2. Always calculate server-side
3. Log all payment operations
4. Handle PayPal webhooks idempotently
5. Test capture rules thoroughly

### When Adding New API Endpoints
1. Add Zod validation schema
2. Implement rate limiting
3. Use standardized error handling
4. Add comprehensive tests
5. Update API documentation

### Cache Invalidation Patterns
- Booking creation: Invalidate car availability for date range
- Booking cancellation: Clear availability and car detail caches
- Car updates: Clear car-specific and fleet caches
- Review updates: Clear review caches

## Deployment Considerations

### Vercel Deployment
- Build output: `.next/` directory
- Environment variables: Set in Vercel dashboard
- Cron jobs: Configure in `vercel.json`
- Edge functions: Automatic from API routes

### Database Migrations
- Always timestamp migration files: `YYYYMMDD_description.sql`
- Test migrations on staging first
- Include rollback procedures
- Document breaking changes

### Monitoring and Alerts
- Vercel Analytics for performance
- Supabase Dashboard for database
- Custom logging with trace IDs
- Webhook health monitoring

## Quick Debugging Tips

### Common Issues and Solutions

1. **Redis Connection Failures**
   - Service gracefully degrades to database-only mode
   - Check `UPSTASH_REDIS_REST_URL` and token

2. **Payment Capture Not Working**
   - Verify `CRON_SECRET` is set
   - Check capture rules in database
   - Review `/api/admin/process-payment-captures` logs

3. **DocuSeal Webhooks Not Received**
   - Verify webhook URL in DocuSeal settings
   - Check signature verification
   - Review webhook retry logs

4. **Rate Limiting Too Aggressive**
   - Adjust limits in `lib/rate-limit/config.ts`
   - Consider user tier-based limits
   - Monitor with `scripts/monitor-rate-limits.ts`

5. **Cache Not Warming**
   - Check Redis connection
   - Verify `ENABLE_CACHE_WARMING_ON_STARTUP` setting
   - Run manual warm: `bunx scripts/warm-cache.ts`
