/**
 * DocuSeal Integration Constants
 * 
 * Centralizes all DocuSeal-related constants including timeouts,
 * retry attempts, and security configurations.
 */

export const DOCUSEAL_CONSTANTS = {
  // Timeouts (in milliseconds)
  CONTRACT_GENERATION_TIMEOUT: 30000, // 30 seconds for contract generation
  PAYMENT_CAPTURE_TIMEOUT: 15000,     // 15 seconds for payment capture
  WEBHOOK_PROCESSING_TIMEOUT: 10000,   // 10 seconds for webhook processing
  API_REQUEST_TIMEOUT: 5000,          // 5 seconds for DocuSeal API requests
  
  // Retry Configuration
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second base delay
  
  // Event Types
  EVENT_TYPES: {
    SUBMISSION_CREATED: 'submission.created',
    SUBMISSION_VIEWED: 'submission.viewed', 
    SUBMISSION_COMPLETED: 'submission.completed',
    SUBMISSION_EXPIRED: 'submission.expired',
    SUBMISSION_ARCHIVED: 'submission.archived',
    TEMPLATE_CREATED: 'template.created',
    TEMPLATE_UPDATED: 'template.updated'
  } as const,
  
  // Status Values
  SUBMISSION_STATUS: {
    PENDING: 'pending',
    SENT: 'sent',
    VIEWED: 'viewed', 
    SIGNED: 'signed',
    COMPLETED: 'completed',
    DECLINED: 'declined',
    EXPIRED: 'expired'
  } as const,
  
  // Phone Number Validation
  PHONE_REGEX: {
    E164: /^\+\d{7,15}$/,
    US_10_DIGIT: /^\d{10}$/
  } as const
} as const;

export type DocuSealEventType = keyof typeof DOCUSEAL_CONSTANTS.EVENT_TYPES;
export type DocuSealSubmissionStatus = keyof typeof DOCUSEAL_CONSTANTS.SUBMISSION_STATUS;