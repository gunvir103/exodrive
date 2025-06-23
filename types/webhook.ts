// Webhook retry status enum
export type WebhookRetryStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'dead_letter';

// Webhook types
export type WebhookType = 'paypal' | 'resend' | 'docuseal';

// Webhook retry record
export interface WebhookRetry {
  id: string;
  webhook_id: string;
  webhook_type: WebhookType;
  payload: any;
  headers?: any;
  endpoint_url: string;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_attempt_at: string | null;
  status: WebhookRetryStatus;
  error_message: string | null;
  error_details: any;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
  succeeded_at: string | null;
  failed_permanently_at: string | null;
}

// Webhook processing log
export interface WebhookProcessingLog {
  id: string;
  webhook_id: string;
  webhook_type: string;
  processed_at: string;
  booking_id: string | null;
  processing_result: any;
}

// Webhook retry metrics from the view
export interface WebhookRetryMetric {
  webhook_type: string;
  status: string;
  count: number;
  avg_attempts: number;
  max_attempts: number;
  oldest_retry: string;
  newest_retry: string;
}

// Dead letter queue item from the view
export interface WebhookDeadLetterItem {
  id: string;
  webhook_id: string;
  webhook_type: string;
  booking_id: string | null;
  payload: any;
  attempt_count: number;
  error_message: string;
  created_at: string;
  failed_permanently_at: string;
}