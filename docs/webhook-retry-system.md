# Webhook Retry System

## Overview

The webhook retry system provides a robust mechanism for handling failed webhooks with automatic retries, exponential backoff, and dead letter queue management. This ensures that critical webhook events (PayPal payments, email notifications, contract signatures) are processed reliably even when temporary failures occur.

## Features

- **Automatic Retry with Exponential Backoff**: Failed webhooks are retried with increasing delays (1min → 5min → 15min → 60min)
- **Maximum 5 Retry Attempts**: Prevents infinite retry loops
- **Dead Letter Queue**: Permanently failed webhooks are stored for manual investigation
- **Idempotency Protection**: Prevents duplicate webhook processing
- **Monitoring Dashboard**: Real-time visibility into webhook processing status
- **Manual Retry Options**: Ability to retry dead letter items

## Architecture

### Database Schema

#### `webhook_retries` Table
Stores failed webhooks for retry processing:
- `webhook_id`: External webhook ID from provider
- `webhook_type`: Type of webhook (paypal, resend, docuseal)
- `payload`: Full webhook payload
- `headers`: Original webhook headers
- `attempt_count`: Number of retry attempts
- `next_retry_at`: When to attempt next retry
- `status`: Current status (pending, processing, succeeded, failed, dead_letter)

#### `webhook_processing_log` Table
Tracks successfully processed webhooks for idempotency:
- `webhook_id`: External webhook ID
- `webhook_type`: Webhook provider type
- `processed_at`: When webhook was processed
- `processing_result`: Result details

### Components

1. **WebhookRetryService** (`/lib/services/webhook-retry-service.ts`)
   - Core service handling retry logic
   - Manages webhook storage and processing
   - Implements exponential backoff calculation

2. **Webhook Handlers** (e.g., `/app/api/webhooks/paypal/route.ts`)
   - Check for idempotency before processing
   - Store failed webhooks for retry
   - Mark successful webhooks as processed

3. **Retry Processor** (`/app/api/webhooks/retry/route.ts`)
   - API endpoint for processing pending retries
   - Called by cron job every 5 minutes
   - Processes up to 10 webhooks per run

4. **Monitoring Dashboard** (`/app/admin/webhooks/page.tsx`)
   - Real-time webhook status monitoring
   - Dead letter queue management
   - Manual retry capabilities

## Implementation Details

### Exponential Backoff Strategy

```typescript
// Retry delays by attempt number
Attempt 1: 1 minute
Attempt 2: 5 minutes
Attempt 3: 15 minutes
Attempt 4+: 60 minutes
```

### Idempotency Check

Before processing any webhook:

```typescript
const isProcessed = await retryService.isWebhookProcessed(webhookId, 'paypal');
if (isProcessed) {
  return NextResponse.json({ message: 'Already processed' });
}
```

### Storing Failed Webhooks

When a webhook fails:

```typescript
await retryService.storeFailedWebhook({
  webhookId: data.id,
  webhookType: 'paypal',
  payload: data,
  headers: headers,
  endpointUrl: webhookUrl,
  bookingId: bookingId,
  errorMessage: error.message,
  errorDetails: { stack: error.stack }
});
```

### Processing Retries

The retry processor:
1. Fetches webhooks where `next_retry_at <= now()`
2. Attempts to process each webhook
3. Updates status based on result:
   - Success → Mark as succeeded
   - Failure with retries left → Schedule next retry
   - Failure with no retries → Move to dead letter queue

## Monitoring

### Metrics Available

- **By Status**: Count of webhooks in each status
- **By Type**: Breakdown by webhook provider
- **Average Attempts**: How many retries are typically needed
- **Dead Letter Queue Size**: Number of permanently failed webhooks

### Dashboard Features

1. **Summary Cards**: Quick overview of system status
2. **Detailed Metrics**: Breakdown by webhook type and status
3. **Dead Letter Queue**: List of failed webhooks with retry option
4. **Manual Process Button**: Trigger retry processing on-demand

## Configuration

### Environment Variables

```env
# Required for webhook retry service
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INTERNAL_API_KEY=optional-api-key-for-cron-endpoint
```

### Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/webhooks/retry",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Manual Cron Setup (Alternative)

If not using Vercel crons, set up a system cron job:

```bash
# Run every minute
* * * * * cd /path/to/project && bun run scripts/process-webhook-retries.ts
```

## Troubleshooting

### Common Issues

1. **Webhooks stuck in processing**
   - Check for crashed retry processes
   - Manually update status to 'pending' to retry

2. **High dead letter queue count**
   - Review error messages for patterns
   - Check if webhook endpoints are accessible
   - Verify webhook payload formats

3. **Duplicate webhook processing**
   - Ensure idempotency checks are in place
   - Check webhook_processing_log for duplicates

### Manual Interventions

1. **Retry a dead letter item**:
   ```sql
   UPDATE webhook_retries 
   SET status = 'pending', 
       next_retry_at = now() + interval '1 minute',
       failed_permanently_at = NULL
   WHERE id = 'webhook-retry-id';
   ```

2. **Mark webhook as processed manually**:
   ```sql
   INSERT INTO webhook_processing_log (webhook_id, webhook_type, processed_at)
   VALUES ('webhook-id', 'paypal', now());
   ```

## Security Considerations

1. **Webhook Signature Verification**: Always verify webhook signatures before processing
2. **Internal API Protection**: Use API keys for cron endpoints
3. **Row Level Security**: Implemented on all webhook tables
4. **Service Role Access**: Only service role can modify webhook data

## Performance Optimization

1. **Indexed Queries**: All frequently queried columns are indexed
2. **Batch Processing**: Process multiple webhooks per cron run
3. **Connection Pooling**: Reuse database connections
4. **Efficient Status Updates**: Minimize database round trips

## Future Enhancements

1. **Circuit Breaker Pattern**: Temporarily stop retrying endpoints that are consistently failing
2. **Webhook Analytics**: Detailed reporting on webhook performance
3. **Custom Retry Strategies**: Configure retry delays per webhook type
4. **Webhook Replay**: Ability to replay successful webhooks for testing