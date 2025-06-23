# Webhook Monitoring System

## Overview

The webhook monitoring system provides comprehensive tracking, retry management, and health monitoring for all webhook integrations (PayPal, Resend, DocuSeal).

## Architecture

### Database Schema

- **webhook_retries**: Stores failed webhooks for retry with exponential backoff
- **webhook_processing_log**: Tracks successfully processed webhooks for idempotency
- **webhook_retry_metrics**: View providing aggregated metrics by webhook type and status
- **webhook_dead_letter_queue**: View showing webhooks that failed after maximum retries

### Key Components

1. **WebhookRetryService** (`/lib/services/webhook-retry-service.ts`)
   - Core service for webhook retry management
   - Handles storing failed webhooks, processing retries, and metrics
   - Implements exponential backoff strategy (1min → 5min → 15min → 60min)

2. **Webhook Monitoring Page** (`/app/admin/webhooks/page.tsx`)
   - Real-time dashboard for webhook status
   - Manual retry triggering for dead letter items
   - Search and filtering capabilities
   - Export functionality for metrics

3. **Server Actions** (`/app/admin/webhooks/actions.ts`)
   - Secure server-side actions for processing retries
   - Admin authentication and authorization

## Features

### 1. Automatic Retry with Exponential Backoff
- Failed webhooks are automatically retried with increasing delays
- Configurable maximum attempts (default: 5)
- Prevents overwhelming external services

### 2. Dead Letter Queue
- Webhooks that fail after maximum retries are moved to dead letter queue
- Manual retry option available for investigation
- Full payload and error history preserved

### 3. Real-time Monitoring
- Live dashboard with auto-refresh (30-second intervals)
- Summary cards showing pending, processing, succeeded, and dead letter counts
- Detailed metrics broken down by webhook type

### 4. Advanced Search and Filtering
- Search by webhook ID, booking ID, or error message
- Filter by webhook type (PayPal, Resend, DocuSeal)
- Filter by status (pending, processing, succeeded, failed, dead_letter)

### 5. Webhook Health Dashboard
- Health score calculation for each webhook type
- Visual indicators for system health
- Alerts and recommendations for issues

### 6. Webhook History
- Complete audit trail of all webhook activity
- Filterable by status and type
- Detailed error messages and retry attempts

### 7. Security Features
- Admin-only access with RLS policies
- Server-side authentication for sensitive operations
- No exposure of internal API keys to client

## Usage

### Accessing the Dashboard

1. Navigate to `/admin/webhooks` for the main monitoring page
2. Use `/admin/webhooks/dashboard` for the comprehensive dashboard with tabs

### Processing Retries

1. Click "Process Retries" to manually trigger retry processing
2. The system will process up to 10 webhooks per batch
3. Results are displayed via toast notifications

### Retrying Dead Letter Items

1. Find the failed webhook in the Dead Letter Queue section
2. Click the eye icon to view full payload details
3. Click "Retry" and confirm to queue the webhook for retry

### Exporting Data

1. Click the "Export" button in the monitoring page
2. Metrics are exported as CSV with timestamp

## Configuration

### Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin Configuration
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Webhook Provider Keys
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
# ... other webhook configurations
```

### Retry Configuration

Modify the exponential backoff strategy in the database function:
```sql
CREATE OR REPLACE FUNCTION calculate_webhook_retry_time(attempt_count integer)
```

## Best Practices

1. **Monitor Health Scores**: Keep an eye on the health dashboard for early warning signs
2. **Investigate Dead Letters**: Regularly review dead letter items for systemic issues
3. **Export Metrics**: Periodically export metrics for long-term analysis
4. **Set Up Alerts**: Configure monitoring alerts for critical thresholds

## Troubleshooting

### Common Issues

1. **Webhooks Not Retrying**
   - Check if the retry processor is running
   - Verify webhooks have `next_retry_at` set
   - Check for database connection issues

2. **High Failure Rate**
   - Review error messages in dead letter queue
   - Check external service availability
   - Verify webhook endpoint URLs and authentication

3. **Performance Issues**
   - Consider increasing batch size in retry processor
   - Add database indexes if needed
   - Monitor database query performance

## Future Enhancements

1. **Real-time Updates**: Implement Supabase subscriptions for live updates
2. **Bulk Operations**: Add bulk retry and bulk delete functionality
3. **Advanced Analytics**: Add trend analysis and predictive alerts
4. **Webhook Testing**: Add webhook endpoint testing capabilities
5. **Integration Monitoring**: Add external service health checks