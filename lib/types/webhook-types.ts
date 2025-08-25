// Webhook retry system types
export type WebhookRetryStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'dead_letter';

export interface WebhookRetry {
  id: string;
  webhook_id: string;
  webhook_type: 'paypal' | 'resend' | 'docuseal';
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

export interface WebhookProcessingLog {
  id: string;
  webhook_id: string;
  webhook_type: string;
  processed_at: string;
  booking_id: string | null;
  processing_result: any;
}

export interface WebhookMetric {
  webhook_type: string;
  status: string;
  count: number;
  avg_attempts: number;
  max_attempts: number;
  oldest_retry: string;
  newest_retry: string;
}

export interface WebhookRetryResult {
  success: boolean;
  shouldRetry: boolean;
  errorMessage?: string;
}