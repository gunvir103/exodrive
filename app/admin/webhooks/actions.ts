'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { WebhookRetryService } from '@/lib/services/webhook-retry-service';

export async function processWebhookRetries() {
  try {
    // Get the server client
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    
    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    
    // Check if user is admin (you may need to adjust this based on your admin check logic)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email || '')) {
      throw new Error('Unauthorized - Admin access required');
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

    return {
      success: true,
      message: 'Webhook retry processing completed',
      results
    };

  } catch (error: any) {
    console.error('Error in webhook retry processor:', error);
    return {
      success: false,
      error: error.message || 'Internal server error'
    };
  }
}

export async function retryDeadLetterWebhook(webhookId: string) {
  try {
    // Get the server client
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    
    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    
    // Check if user is admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email || '')) {
      throw new Error('Unauthorized - Admin access required');
    }
    
    // Initialize retry service
    const retryService = new WebhookRetryService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Retry the dead letter item
    const success = await retryService.retryDeadLetterItem(webhookId);
    
    if (success) {
      return {
        success: true,
        message: 'Webhook queued for retry'
      };
    } else {
      throw new Error('Failed to retry webhook');
    }
    
  } catch (error: any) {
    console.error('Error retrying dead letter webhook:', error);
    return {
      success: false,
      error: error.message || 'Failed to retry webhook'
    };
  }
}