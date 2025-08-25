#!/usr/bin/env bun

import { WebhookRetryService } from '../lib/services/webhook-retry-service';

// This script should be run as a cron job every minute
// Example crontab entry: * * * * * cd /path/to/project && bun run scripts/process-webhook-retries.ts

async function processWebhookRetries() {
  console.log(`[${new Date().toISOString()}] Starting webhook retry processing...`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const retryService = new WebhookRetryService(supabaseUrl, supabaseServiceKey);

  try {
    // Get metrics first
    const metrics = await retryService.getMetrics();
    const pendingCount = metrics.find(m => m.status === 'pending')?.count || 0;
    
    if (pendingCount === 0) {
      console.log('No webhooks pending retry');
      return;
    }

    console.log(`Found ${pendingCount} webhooks pending retry`);

    // Process up to 20 webhooks per run to avoid long-running processes
    const webhooksToRetry = await retryService.getWebhooksForRetry(20);
    
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      retrying: 0,
      errors: [] as string[]
    };

    for (const webhook of webhooksToRetry) {
      try {
        console.log(`Processing webhook ${webhook.id} (${webhook.webhook_type}) - attempt ${webhook.attempt_count + 1}/${webhook.max_attempts}`);
        
        const result = await retryService.processWebhookRetry(webhook);
        results.processed++;
        
        if (result.success) {
          results.succeeded++;
          console.log(`✓ Webhook ${webhook.id} succeeded`);
        } else if (result.shouldRetry) {
          results.retrying++;
          console.log(`↻ Webhook ${webhook.id} will be retried later: ${result.errorMessage}`);
        } else {
          results.failed++;
          console.log(`✗ Webhook ${webhook.id} permanently failed: ${result.errorMessage}`);
        }
      } catch (error: any) {
        console.error(`Error processing webhook ${webhook.id}:`, error);
        results.errors.push(`${webhook.id}: ${error.message}`);
      }
    }

    console.log(`\nProcessing complete:
  - Processed: ${results.processed}
  - Succeeded: ${results.succeeded}
  - Will retry: ${results.retrying}
  - Failed permanently: ${results.failed}
  - Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.error('\nErrors encountered:');
      results.errors.forEach(err => console.error(`  - ${err}`));
    }

    // Log final metrics
    const finalMetrics = await retryService.getMetrics();
    const deadLetterCount = finalMetrics.find(m => m.status === 'dead_letter')?.count || 0;
    
    if (deadLetterCount > 0) {
      console.warn(`\n⚠️  ${deadLetterCount} webhooks in dead letter queue require manual intervention`);
    }

  } catch (error: any) {
    console.error('Fatal error in webhook retry processor:', error);
    process.exit(1);
  }
}

// Run the processor
processWebhookRetries()
  .then(() => {
    console.log(`[${new Date().toISOString()}] Webhook retry processing completed`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });