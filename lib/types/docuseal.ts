/**
 * DocuSeal Type Definitions
 * 
 * Comprehensive type-safe interfaces for DocuSeal integration
 * Replaces all uses of 'any' with proper TypeScript types
 */

import { Database } from '@/lib/supabase/database.types';

// Database type aliases for clarity
export type ContractStatus = Database['public']['Enums']['contract_status_enum'];
export type BookingEventType = Database['public']['Enums']['booking_event_type_enum'];

/**
 * DocuSeal API Response Types
 */
export interface DocuSealSubmitter {
  id: number;
  slug: string;
  email: string;
  name?: string;
  phone?: string;
  status: 'pending' | 'sent' | 'opened' | 'completed' | 'declined';
  sent_at: string | null;
  opened_at?: string | null;
  viewed_at?: string | null;
  completed_at: string | null;
  declined_at?: string | null;
  metadata: DocuSealMetadata;
}

export interface DocuSealTemplate {
  id: number;
  name: string;
  slug?: string;
  folder_name?: string;
}

export interface DocuSealDocument {
  id: number;
  name: string;
  url: string;
  filename?: string;
}

export interface DocuSealMetadata {
  booking_id?: string;
  booking_reference?: string;
  customer_id?: string;
  car_id?: string;
  rental_dates?: string;
  rental_days?: number;
  total_amount?: number;
  currency?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface DocuSealSubmissionResponse {
  id: number;
  slug: string;
  source: string;
  submitters: DocuSealSubmitter[];
  template: DocuSealTemplate;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  archived_at?: string | null;
  expire_at?: string | null;
  documents?: DocuSealDocument[];
  metadata?: DocuSealMetadata;
  submission_id?: number; // Alternative field name
}

/**
 * Database Update Types
 */
export interface ContractUpdateData {
  contract_submission_id: string;
  contract_status: ContractStatus;
  contract_signed_at?: string | null;
  contract_document_id?: string | null;
  contract_signing_url?: string | null;
  contract_template_version?: number | null;
  updated_at: string;
}

export interface BookingEventInsert {
  booking_id: string;
  event_type: BookingEventType | string; // Allow custom event types
  timestamp?: string;
  actor_type: Database['public']['Enums']['actor_type_enum'] | null;
  actor_id: string;
  actor_name?: string | null;
  summary_text?: string | null;
  details?: BookingEventDetails;
}

export interface BookingEventDetails {
  submission_id?: string | number;
  submission_slug?: string;
  template_id?: number;
  docuseal_event_type?: string;
  docuseal_submission_id?: string | number;
  template_name?: string;
  sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  declined_at?: string;
  declined_by?: string;
  archived_at?: string;
  expired_at?: string;
  documents?: DocuSealDocument[];
  error?: string;
  contract_signed_at?: string;
  capture_id?: string;
  requires_manual_intervention?: boolean;
  [key: string]: unknown; // Allow additional fields but discourage their use
}

/**
 * Booking Media Insert Type
 */
export interface BookingMediaInsert {
  booking_id: string;
  media_type: 'signed_contract' | string;
  file_url?: string;
  file_path?: string;
  file_name: string;
  uploaded_at: string;
  uploaded_by_type: Database['public']['Enums']['booking_media_uploader_enum'];
  uploaded_by_id: string;
  metadata?: {
    docuseal_document_id: number;
    docuseal_submission_id: number;
    [key: string]: unknown;
  };
}

/**
 * Webhook Processing Types
 */
export interface DocuSealWebhookPayload {
  event_type: string;
  timestamp: number;
  data: DocuSealWebhookData;
}

export interface DocuSealWebhookData {
  id: number;
  submission_id?: number;
  slug?: string;
  source?: string;
  submitters?: DocuSealSubmitter[];
  template?: DocuSealTemplate;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  completed_at?: string | null;
  expire_at?: string | null;
  documents?: DocuSealDocument[];
  metadata?: DocuSealMetadata;
}

/**
 * Contract Status Mapping
 */
export const CONTRACT_STATUS_MAP: Record<string, ContractStatus> = {
  'submission.created': 'sent',
  'submission.viewed': 'viewed',
  'submission.completed': 'signed',
  'submission.declined': 'declined',
  'submission.expired': 'voided',
} as const;

/**
 * Type Guards
 */
export function isValidContractStatus(status: string): status is ContractStatus {
  return ['not_sent', 'sent', 'viewed', 'signed', 'declined', 'voided'].includes(status);
}

export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function extractSubmissionId(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') return undefined;
  
  const obj = response as Record<string, unknown>;
  
  // Check various possible locations for the submission ID
  const possibleIds = [
    obj.id,
    obj.submission_id,
    (obj.submission as Record<string, unknown>)?.id,
    (obj.data as Record<string, unknown>)?.id,
    Array.isArray(obj) && obj[0]?.id
  ];
  
  for (const id of possibleIds) {
    if (id !== undefined && id !== null) {
      return String(id);
    }
  }
  
  return undefined;
}

/**
 * Safe Metadata Extraction
 */
export function extractBookingId(data: DocuSealWebhookData): string | undefined {
  const rawBookingId = data.metadata?.booking_id || 
                      data.submitters?.[0]?.metadata?.booking_id;
  
  if (!rawBookingId) return undefined;
  
  const bookingId = String(rawBookingId).trim();
  return isValidUUID(bookingId) ? bookingId : undefined;
}