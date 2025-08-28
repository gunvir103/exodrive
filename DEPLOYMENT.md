# ExoDrive Deployment Guide

This guide covers the complete deployment process for ExoDrive, including environment setup, platform configuration, and troubleshooting.

## Table of Contents

- [Quick Deployment Checklist](#quick-deployment-checklist)
- [Environment Variables](#environment-variables)
- [Vercel Deployment](#vercel-deployment)
- [Supabase Configuration](#supabase-configuration)
- [Third-Party Service Setup](#third-party-service-setup)
- [Database Migrations](#database-migrations)
- [Post-Deployment Verification](#post-deployment-verification)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)

## Quick Deployment Checklist

### Pre-Deployment Requirements
- [ ] Supabase project created and configured
- [ ] PayPal developer account setup (sandbox + live)
- [ ] Upstash Redis instance created
- [ ] Resend account setup for email delivery
- [ ] DocuSeal instance configured (optional)
- [ ] Domain name configured (production only)

### Essential Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `PAYPAL_CLIENT_ID`
- [ ] `PAYPAL_CLIENT_SECRET`
- [ ] `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] `RESEND_API_KEY`
- [ ] `NEXT_PUBLIC_BASE_URL`
- [ ] `CRON_SECRET`

### Deployment Steps
- [ ] Configure environment variables
- [ ] Deploy to Vercel
- [ ] Run database migrations
- [ ] Configure webhooks
- [ ] Verify functionality
- [ ] Set up monitoring

## Environment Variables

### Required Variables

#### Supabase (Database & Auth)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### PayPal (Payment Processing)
```env
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_MODE=sandbox  # or 'live' for production
PAYPAL_WEBHOOK_ID=your-webhook-id
```

#### Redis (Caching)
```env
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

#### Email (Resend)
```env
RESEND_API_KEY=re_your-api-key
```

#### Application
```env
NEXT_PUBLIC_BASE_URL=https://your-domain.com
CRON_SECRET=your-secure-cron-secret
```

### Optional Variables

#### Analytics
```env
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=your-pixel-id
```

#### SEO Verification
```env
GOOGLE_SITE_VERIFICATION=your-google-verification-code
BING_VERIFICATION=your-bing-verification-code
```

#### DocuSeal (Contract Automation)
```env
DOCUSEAL_INSTANCE_URL=https://docuseal.yourdomain.com
DOCUSEAL_API_TOKEN=your-api-token
DOCUSEAL_TEMPLATE_ID=your-template-id
```

## Vercel Deployment

### 1. Initial Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
vercel
```

### 2. Project Configuration

Create `vercel.json` in your project root:

```json
{
  "build": {
    "env": {
      "NEXT_PUBLIC_SUPABASE_URL": "@next_public_supabase_url",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@next_public_supabase_anon_key",
      "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key"
    }
  },
  "functions": {
    "app/api/webhooks/paypal/route.ts": {
      "maxDuration": 30
    },
    "app/api/bookings/route.ts": {
      "maxDuration": 25
    }
  },
  "crons": [
    {
      "path": "/api/cron/capture-payments",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### 3. Environment Variables in Vercel

Set environment variables in Vercel dashboard:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate scope:
   - **Production**: Live environment
   - **Preview**: Staging/PR environments
   - **Development**: Local development

### 4. Build Configuration

The project uses `next.config.mjs` with these optimizations:

```javascript
// Key configurations for deployment
{
  output: 'standalone',           // Docker/container deployments
  experimental: {
    optimizePackageImports: [     // Reduces bundle size
      '@radix-ui/react-*',
      'lucide-react',
      '@supabase/supabase-js'
    ],
    serverActions: {
      bodySizeLimit: '2mb'        // File upload support
    }
  }
}
```

### 5. Custom Domains

1. Add your domain in Vercel dashboard
2. Configure DNS records:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
3. Update `NEXT_PUBLIC_BASE_URL` to your domain

## Supabase Configuration

### 1. Project Setup

1. Create new Supabase project
2. Note your project URL and keys
3. Configure authentication settings
4. Set up Row Level Security (RLS)

### 2. Database Schema

Run migrations to set up the database:

```bash
# Local development
bun run db:migrate

# Production (manual)
# Run SQL files in supabase/migrations/ directory
```

### 3. Row Level Security Policies

Ensure RLS is enabled on all tables:

```sql
-- Example RLS policy for bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookings" ON bookings
    FOR SELECT USING (auth.uid() = user_id);
```

### 4. Storage Configuration

Set up storage buckets for car images:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('car-images', 'car-images', true);

-- Set up storage policies
CREATE POLICY "Anyone can view car images" ON storage.objects
    FOR SELECT USING (bucket_id = 'car-images');
```

## Third-Party Service Setup

### PayPal Configuration

1. **Developer Dashboard**
   - Create sandbox and live applications
   - Generate client credentials
   - Configure webhook endpoints

2. **Webhook Setup**
   ```
   Webhook URL: https://your-domain.com/api/webhooks/paypal
   Events: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED
   ```

3. **Testing**
   ```bash
   # Test PayPal integration
   curl -X POST https://your-domain.com/api/bookings/create-paypal-order \
     -H "Content-Type: application/json" \
     -d '{"amount": 100}'
   ```

### Upstash Redis

1. **Create Instance**
   - Choose region close to your deployment
   - Note REST URL and token

2. **Test Connection**
   ```bash
   curl -X GET "https://your-redis-url/ping" \
     -H "Authorization: Bearer your-token"
   ```

### Resend Email

1. **API Key Setup**
   - Generate API key in Resend dashboard
   - Verify domain (production)

2. **Test Email Delivery**
   ```bash
   # Test email service
   curl -X POST https://your-domain.com/api/test-email \
     -H "Authorization: Bearer your-api-key"
   ```

## Database Migrations

### Production Migration Process

1. **Backup Database**
   ```sql
   -- Create backup before migration
   pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run Migrations**
   ```bash
   # Verify migration files
   ls supabase/migrations/

   # Apply migrations (in Supabase SQL editor)
   -- Run each migration file in chronological order
   ```

3. **Verify Schema**
   ```bash
   # Run verification script
   bun run verify:db
   ```

## Post-Deployment Verification

### Health Check Endpoints

Test these endpoints after deployment:

```bash
# Database connectivity
curl https://your-domain.com/api/test-supabase/check-connection

# Redis connectivity
curl https://your-domain.com/api/health/redis

# Email service
curl https://your-domain.com/api/health/email

# PayPal integration
curl https://your-domain.com/api/health/paypal
```

### Functional Testing

1. **User Flow Testing**
   - Car browsing ✓
   - Booking creation ✓
   - Payment processing ✓
   - Email notifications ✓
   - Admin dashboard ✓

2. **Performance Testing**
   ```bash
   # Load test key endpoints
   artillery run performance-test.yml
   ```

### Monitoring Setup

1. **Error Tracking**
   - Configure Sentry (optional)
   - Set up Vercel Analytics

2. **Performance Monitoring**
   - Enable Vercel Speed Insights
   - Monitor Core Web Vitals

## Troubleshooting

### Common Issues

#### 1. Environment Variable Not Found
```
Error: NEXT_PUBLIC_SUPABASE_URL is not defined
```
**Solution:**
- Verify variable is set in Vercel dashboard
- Check variable name spelling
- Ensure variable is available in correct environment

#### 2. Database Connection Failed
```
Error: Could not connect to Supabase
```
**Solution:**
- Verify Supabase project status
- Check service role key permissions
- Confirm RLS policies allow access

#### 3. PayPal Webhook Verification Failed
```
Error: Webhook signature verification failed
```
**Solution:**
- Verify webhook URL in PayPal dashboard
- Check `PAYPAL_WEBHOOK_ID` configuration
- Ensure webhook events are configured

#### 4. Redis Connection Timeout
```
Error: Redis connection timed out
```
**Solution:**
- Check Upstash instance status
- Verify REST URL and token
- Test connection from deployment region

#### 5. Email Delivery Failed
```
Error: Failed to send email via Resend
```
**Solution:**
- Verify Resend API key
- Check domain verification status
- Review email templates syntax

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
DEBUG=true
```

### Log Analysis

Monitor deployment logs:

```bash
# Vercel logs
vercel logs your-deployment-url

# Function logs
vercel logs --follow
```

## Performance Optimization

### 1. Caching Strategy

- **Redis**: API responses, database queries
- **CDN**: Static assets, images
- **Browser**: Client-side caching headers

### 2. Database Optimization

- **Indexes**: Ensure proper indexing on frequently queried columns
- **Connection Pooling**: Use Supabase connection pooling
- **Query Optimization**: Monitor slow queries

### 3. Bundle Optimization

```javascript
// next.config.mjs optimizations
experimental: {
  optimizePackageImports: [
    '@radix-ui/react-*',
    'lucide-react',
    '@supabase/supabase-js'
  ]
}
```

### 4. Image Optimization

- Use Next.js Image component
- Configure remote image domains
- Enable image optimization in Vercel

## Security Considerations

### 1. API Security

- **Rate Limiting**: Implemented for all public APIs
- **Authentication**: JWT token validation
- **CORS**: Configured for allowed origins

### 2. Database Security

- **RLS Policies**: Row-level security on all tables
- **Service Key Protection**: Never expose server-side keys
- **Input Validation**: Zod schemas for all inputs

### 3. Payment Security

- **Webhook Verification**: PayPal signature validation
- **HTTPS Only**: All payment endpoints use HTTPS
- **PCI Compliance**: No card data stored locally

### 4. Environment Security

- **Secret Rotation**: Regular key rotation schedule
- **Access Control**: Principle of least privilege
- **Audit Logs**: Monitor access and changes

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check performance metrics
   - Monitor database usage

2. **Monthly**
   - Update dependencies
   - Review security advisories
   - Rotate API keys (if needed)

3. **Quarterly**
   - Performance audit
   - Security assessment
   - Backup verification

### Monitoring Checklist

- [ ] Application uptime
- [ ] Database performance
- [ ] Cache hit rates
- [ ] Error rates
- [ ] Payment success rates
- [ ] Email delivery rates

---

## Support

For deployment issues:

1. Check this troubleshooting guide
2. Review Vercel deployment logs
3. Monitor Supabase dashboard
4. Check third-party service status pages

**Key Documentation Links:**
- [Vercel Deployment Guide](https://vercel.com/docs/deployments)
- [Supabase Production Guide](https://supabase.com/docs/guides/platform/going-to-prod)
- [Next.js Deployment](https://nextjs.org/docs/deployment)