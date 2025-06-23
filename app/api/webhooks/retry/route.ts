import { NextRequest, NextResponse } from 'next/server';
import { WebhookRetryService } from '@/lib/services/webhook-retry-service';

// This endpoint should be called by a cron job or scheduled task
// It processes pending webhook retries
export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal request (you might want to add API key authentication)
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.INTERNAL_API_KEY;
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize retry service
    const retryService = new WebhookRetryService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get webhooks ready for retry
    const webhooksToRetry = await retryService.getWebhooksForRetry(10);
    
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      retrying: 0,
      errors: [] as string[]
    };

    // Process each webhook
    for (const webhook of webhooksToRetry) {
      try {
        console.log(`Processing webhook retry: ${webhook.id} (attempt ${webhook.attempt_count + 1})`);
        
        const result = await retryService.processWebhookRetry(webhook);
        results.processed++;
        
        if (result.success) {
          results.succeeded++;
          console.log(`Webhook retry succeeded: ${webhook.id}`);
        } else if (result.shouldRetry) {
          results.retrying++;
          console.log(`Webhook will be retried later: ${webhook.id}`);
        } else {
          results.failed++;
          console.log(`Webhook permanently failed: ${webhook.id}`);
        }
      } catch (error: any) {
        console.error(`Error processing webhook ${webhook.id}:`, error);
        results.errors.push(`${webhook.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      message: 'Webhook retry processing completed',
      results
    });

  } catch (error: any) {
    console.error('Error in webhook retry processor:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check retry queue status
export async function GET(request: NextRequest) {
  try {
    // Verify this is an internal request
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.INTERNAL_API_KEY;
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize retry service
    const retryService = new WebhookRetryService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get metrics
    const metrics = await retryService.getMetrics();
    const deadLetterCount = metrics.find(m => m.status === 'dead_letter')?.count || 0;
    const pendingCount = metrics.find(m => m.status === 'pending')?.count || 0;
    const processingCount = metrics.find(m => m.status === 'processing')?.count || 0;

    return NextResponse.json({
      metrics,
      summary: {
        pending: pendingCount,
        processing: processingCount,
        dead_letter: deadLetterCount,
        total_active: pendingCount + processingCount
      }
    });

  } catch (error: any) {
    console.error('Error fetching webhook retry metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}