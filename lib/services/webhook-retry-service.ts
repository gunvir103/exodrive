import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { 
  WebhookRetry, 
  WebhookRetryStatus, 
  WebhookType, 
  WebhookProcessingLog,
  WebhookRetryMetric,
  WebhookDeadLetterItem
} from '@/types/webhook';

// Define proper database types
type WebhookRetriesRow = Database['public']['Tables']['webhook_retries']['Row'];
type WebhookRetriesInsert = Database['public']['Tables']['webhook_retries']['Insert'];
type WebhookRetriesUpdate = Database['public']['Tables']['webhook_retries']['Update'];
type WebhookRetryMetricsRow = Database['public']['Views']['webhook_retry_metrics']['Row'];
type WebhookDeadLetterQueueRow = Database['public']['Views']['webhook_dead_letter_queue']['Row'];

export class WebhookRetryService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Store a failed webhook for retry
   */
  async storeFailedWebhook(params: {
    webhookId: string;
    webhookType: WebhookType;
    payload: any;
    headers?: any;
    endpointUrl: string;
    bookingId?: string;
    errorMessage: string;
    errorDetails?: any;
  }): Promise<WebhookRetry | null> {
    try {
      // Calculate next retry time (1 minute for first retry)
      const { data: retryTime } = await this.supabase.rpc('calculate_webhook_retry_time', {
        attempt_count: 0
      });

      const { data, error } = await this.supabase
        .from('webhook_retries')
        .insert({
          webhook_id: params.webhookId,
          webhook_type: params.webhookType,
          payload: params.payload,
          headers: params.headers,
          endpoint_url: params.endpointUrl,
          booking_id: params.bookingId,
          error_message: params.errorMessage,
          error_details: params.errorDetails,
          next_retry_at: retryTime,
          status: 'pending' as WebhookRetryStatus
        })
        .select()
        .single();

      if (error) {
        console.error('Error storing failed webhook:', error);
        return null;
      }

      return data as WebhookRetry;
    } catch (error) {
      console.error('Error in storeFailedWebhook:', error);
      return null;
    }
  }

  /**
   * Check if a webhook has already been processed
   */
  async isWebhookProcessed(webhookId: string, webhookType: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('is_webhook_processed', {
        p_webhook_id: webhookId,
        p_webhook_type: webhookType
      });

      if (error) {
        console.error('Error checking webhook processed status:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error in isWebhookProcessed:', error);
      return false;
    }
  }

  /**
   * Mark a webhook as successfully processed
   */
  async markWebhookProcessed(
    webhookId: string,
    webhookType: string,
    bookingId?: string,
    processingResult?: any
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('mark_webhook_processed', {
        p_webhook_id: webhookId,
        p_webhook_type: webhookType,
        p_booking_id: bookingId,
        p_processing_result: processingResult || null
      });

      if (error) {
        console.error('Error marking webhook as processed:', error);
      }
    } catch (error) {
      console.error('Error in markWebhookProcessed:', error);
    }
  }

  /**
   * Get webhooks ready for retry
   */
  async getWebhooksForRetry(limit: number = 10): Promise<WebhookRetry[]> {
    try {
      const { data, error } = await this.supabase
        .from('webhook_retries')
        .select('*')
        .in('status', ['pending', 'processing'])
        .not('next_retry_at', 'is', null)
        .lte('next_retry_at', new Date().toISOString())
        .order('next_retry_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching webhooks for retry:', error);
        return [];
      }

      return (data || []) as WebhookRetry[];
    } catch (error) {
      console.error('Error in getWebhooksForRetry:', error);
      return [];
    }
  }

  /**
   * Update webhook retry status
   */
  async updateWebhookRetry(
    retryId: string,
    updates: {
      status?: WebhookRetryStatus;
      attempt_count?: number;
      last_attempt_at?: string;
      next_retry_at?: string | null;
      error_message?: string | null;
      error_details?: any;
      succeeded_at?: string | null;
      failed_permanently_at?: string | null;
    }
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('webhook_retries')
        .update(updates)
        .eq('id', retryId);

      if (error) {
        console.error('Error updating webhook retry:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateWebhookRetry:', error);
      return false;
    }
  }

  /**
   * Process a webhook retry
   */
  async processWebhookRetry(retry: WebhookRetry): Promise<{
    success: boolean;
    shouldRetry: boolean;
    errorMessage?: string;
  }> {
    // Mark as processing
    await this.updateWebhookRetry(retry.id, {
      status: 'processing',
      last_attempt_at: new Date().toISOString()
    });

    try {
      // Make the webhook request
      const response = await fetch(retry.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...retry.headers,
          'X-Webhook-Retry': 'true',
          'X-Webhook-Retry-Attempt': String(retry.attempt_count + 1)
        },
        body: JSON.stringify(retry.payload)
      });

      if (response.ok) {
        // Success - mark as succeeded
        await this.updateWebhookRetry(retry.id, {
          status: 'succeeded',
          succeeded_at: new Date().toISOString(),
          attempt_count: retry.attempt_count + 1
        });

        // Mark webhook as processed if it has an ID
        if (retry.webhook_id && retry.webhook_type) {
          await this.markWebhookProcessed(
            retry.webhook_id,
            retry.webhook_type,
            retry.booking_id || undefined,
            { retry_succeeded: true, attempts: retry.attempt_count + 1 }
          );
        }

        return { success: true, shouldRetry: false };
      } else {
        // HTTP error
        const errorText = await response.text();
        const errorMessage = `HTTP ${response.status}: ${errorText}`;
        
        return await this.handleRetryFailure(retry, errorMessage, {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
      }
    } catch (error: any) {
      // Network or other error
      const errorMessage = error.message || 'Unknown error';
      return await this.handleRetryFailure(retry, errorMessage, {
        type: 'network_error',
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Handle retry failure and determine if we should retry again
   */
  private async handleRetryFailure(
    retry: WebhookRetry,
    errorMessage: string,
    errorDetails: any
  ): Promise<{ success: boolean; shouldRetry: boolean; errorMessage: string }> {
    const newAttemptCount = retry.attempt_count + 1;
    
    if (newAttemptCount >= retry.max_attempts) {
      // Move to dead letter queue
      await this.updateWebhookRetry(retry.id, {
        status: 'dead_letter',
        attempt_count: newAttemptCount,
        error_message: errorMessage,
        error_details: errorDetails,
        failed_permanently_at: new Date().toISOString()
      });

      return { success: false, shouldRetry: false, errorMessage };
    } else {
      // Calculate next retry time
      const { data: nextRetryTime } = await this.supabase.rpc('calculate_webhook_retry_time', {
        attempt_count: newAttemptCount
      });

      // Update for next retry
      await this.updateWebhookRetry(retry.id, {
        status: 'pending',
        attempt_count: newAttemptCount,
        next_retry_at: nextRetryTime,
        error_message: errorMessage,
        error_details: errorDetails
      });

      return { success: false, shouldRetry: true, errorMessage };
    }
  }

  /**
   * Get webhook retry metrics
   */
  async getMetrics(): Promise<WebhookRetryMetric[]> {
    try {
      const { data, error } = await this.supabase
        .from('webhook_retry_metrics')
        .select('*');

      if (error) {
        console.error('Error fetching webhook metrics:', error);
        return [];
      }

      return (data || []).map(row => ({
        webhook_type: row.webhook_type || '',
        status: row.status || '',
        count: row.count || 0,
        avg_attempts: row.avg_attempts || 0,
        max_attempts: row.max_attempts || 0,
        oldest_retry: row.oldest_retry || '',
        newest_retry: row.newest_retry || ''
      }));
    } catch (error) {
      console.error('Error in getMetrics:', error);
      return [];
    }
  }

  /**
   * Get dead letter queue items
   */
  async getDeadLetterQueue(limit: number = 50): Promise<WebhookDeadLetterItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('webhook_dead_letter_queue')
        .select('*')
        .limit(limit);

      if (error) {
        console.error('Error fetching dead letter queue:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id || '',
        webhook_id: row.webhook_id || '',
        webhook_type: row.webhook_type || '',
        booking_id: row.booking_id,
        payload: row.payload,
        attempt_count: row.attempt_count || 0,
        error_message: row.error_message || '',
        created_at: row.created_at || '',
        failed_permanently_at: row.failed_permanently_at || ''
      }));
    } catch (error) {
      console.error('Error in getDeadLetterQueue:', error);
      return [];
    }
  }

  /**
   * Manually retry a dead letter item
   */
  async retryDeadLetterItem(retryId: string): Promise<boolean> {
    try {
      // Reset the retry for another attempt
      const { data: nextRetryTime } = await this.supabase.rpc('calculate_webhook_retry_time', {
        attempt_count: 0
      });

      const success = await this.updateWebhookRetry(retryId, {
        status: 'pending',
        next_retry_at: String(nextRetryTime),
        failed_permanently_at: null
      });

      return success;
    } catch (error) {
      console.error('Error retrying dead letter item:', error);
      return false;
    }
  }
}