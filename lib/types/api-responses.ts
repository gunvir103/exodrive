/**
 * Standardized API Response Types
 * All API endpoints should return responses conforming to these types
 */

// Base response types
export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  metadata?: Record<string, any>;
}

export interface ApiErrorResponse {
  success?: false;
  error: string;
  code: string;
  details?: any;
  statusCode?: number;
}

export interface ApiPaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Standard error codes
export const API_ERROR_CODES = {
  // Authentication & Authorization
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Business logic errors
  INVALID_BOOKING: 'INVALID_BOOKING',
  BOOKING_NOT_AVAILABLE: 'BOOKING_NOT_AVAILABLE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CONTRACT_REQUIRED: 'CONTRACT_REQUIRED',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// Helper type for consistent API responses
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Specific response types for common endpoints
export interface FileUploadResponse {
  publicUrl: string;
  storagePath: string;
  fileName: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database: boolean;
    storage: boolean;
    cache?: boolean;
    email?: boolean;
  };
}

// Helper functions for creating consistent responses
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  metadata?: Record<string, any>
): ApiSuccessResponse<T> => ({
  success: true,
  data,
  message,
  metadata
});

export const createErrorResponse = (
  error: string,
  code: ApiErrorCode,
  details?: any,
  statusCode?: number
): ApiErrorResponse => ({
  success: false,
  error,
  code,
  details,
  statusCode
});

export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): ApiPaginatedResponse<T> => ({
  success: true,
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  }
});