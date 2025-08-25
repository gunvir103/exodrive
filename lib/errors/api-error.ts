export enum ErrorCodes {
  // Client errors (4xx)
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR'
}

export interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: any;          // Additional error details
    timestamp: string;      // ISO 8601 timestamp
    traceId: string;        // Request trace ID for debugging
  };
  status: number;          // HTTP status code
}

export class ApiError extends Error {
  public readonly code: ErrorCodes;
  public readonly status: number;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(
    code: ErrorCodes,
    message: string,
    status: number,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON(): Omit<ErrorResponse['error'], 'traceId'> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// Common error factory functions
export const errors = {
  badRequest: (message: string, details?: any) => 
    new ApiError(ErrorCodes.INVALID_REQUEST, message, 400, details),
  
  unauthorized: (message: string = 'Unauthorized') => 
    new ApiError(ErrorCodes.UNAUTHORIZED, message, 401),
  
  forbidden: (message: string = 'Forbidden') => 
    new ApiError(ErrorCodes.FORBIDDEN, message, 403),
  
  notFound: (resource: string) => 
    new ApiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),
  
  conflict: (message: string, details?: any) => 
    new ApiError(ErrorCodes.CONFLICT, message, 409, details),
  
  rateLimited: (retryAfter?: number) => 
    new ApiError(
      ErrorCodes.RATE_LIMITED, 
      'Too many requests, please try again later', 
      429, 
      { retryAfter }
    ),
  
  validationError: (message: string, errors: any) => 
    new ApiError(ErrorCodes.VALIDATION_ERROR, message, 400, errors),
  
  internalError: (message: string = 'An unexpected error occurred') => 
    new ApiError(ErrorCodes.INTERNAL_ERROR, message, 500),
  
  databaseError: (message: string = 'Database operation failed') => 
    new ApiError(ErrorCodes.DATABASE_ERROR, message, 500),
  
  externalServiceError: (service: string, message?: string) => 
    new ApiError(
      ErrorCodes.EXTERNAL_SERVICE_ERROR, 
      message || `External service error: ${service}`, 
      502
    ),
  
  cacheError: (message: string = 'Cache operation failed') => 
    new ApiError(ErrorCodes.CACHE_ERROR, message, 500),
};