/**
 * Error Handler Utility
 * Sanitizes errors for production and provides user-friendly messages
 */

import { logger } from './logger';

interface ErrorResponse {
  error: string;
  code?: string;
  statusCode: number;
  details?: any;
}

interface ErrorMapping {
  [key: string]: {
    message: string;
    statusCode: number;
  };
}

class ErrorHandler {
  private isDevelopment: boolean;
  private isProduction: boolean;
  private errorMappings: ErrorMapping;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Common error mappings
    this.errorMappings = {
      // Supabase/PostgreSQL errors
      'P2002': { message: 'This resource already exists', statusCode: 409 },
      'P2025': { message: 'Resource not found', statusCode: 404 },
      'P2003': { message: 'Invalid reference', statusCode: 400 },
      'P2014': { message: 'Invalid relation', statusCode: 400 },
      'P2015': { message: 'Related record not found', statusCode: 404 },
      'P2016': { message: 'Query interpretation error', statusCode: 400 },
      
      // Auth errors
      'invalid_credentials': { message: 'Invalid email or password', statusCode: 401 },
      'email_not_confirmed': { message: 'Please confirm your email address', statusCode: 401 },
      'user_not_found': { message: 'User not found', statusCode: 404 },
      'weak_password': { message: 'Password does not meet requirements', statusCode: 400 },
      'rate_limit': { message: 'Too many attempts. Please try again later', statusCode: 429 },
      'unauthorized': { message: 'You are not authorized to perform this action', statusCode: 403 },
      'session_expired': { message: 'Your session has expired. Please login again', statusCode: 401 },
      
      // Booking errors
      'car_unavailable': { message: 'This car is not available for the selected dates', statusCode: 409 },
      'booking_conflict': { message: 'Another booking exists for these dates', statusCode: 409 },
      'invalid_dates': { message: 'Invalid booking dates provided', statusCode: 400 },
      'payment_failed': { message: 'Payment could not be processed', statusCode: 402 },
      
      // Generic errors
      'not_found': { message: 'The requested resource was not found', statusCode: 404 },
      'bad_request': { message: 'Invalid request. Please check your input', statusCode: 400 },
      'internal_error': { message: 'An unexpected error occurred. Please try again', statusCode: 500 },
      'service_unavailable': { message: 'Service temporarily unavailable', statusCode: 503 },
    };
  }

  /**
   * Extract error code from various error types
   */
  private extractErrorCode(error: any): string | undefined {
    // Supabase error
    if (error?.code) return error.code;
    
    // PostgreSQL error
    if (error?.meta?.code) return error.meta.code;
    
    // Custom error code
    if (error?.errorCode) return error.errorCode;
    
    // Error message patterns
    if (typeof error?.message === 'string') {
      // Check for known patterns
      if (error.message.includes('Invalid login credentials')) return 'invalid_credentials';
      if (error.message.includes('Email not confirmed')) return 'email_not_confirmed';
      if (error.message.includes('rate limit')) return 'rate_limit';
      if (error.message.includes('not found')) return 'not_found';
      if (error.message.includes('unauthorized')) return 'unauthorized';
      if (error.message.includes('expired')) return 'session_expired';
    }
    
    return undefined;
  }

  /**
   * Sanitize error for production
   */
  sanitize(error: any): ErrorResponse {
    // Log the full error for debugging
    logger.error('Error occurred', error);
    
    const errorCode = this.extractErrorCode(error);
    const mapping = errorCode ? this.errorMappings[errorCode] : undefined;
    
    // In development, return more details
    if (this.isDevelopment) {
      return {
        error: error?.message || 'An error occurred',
        code: errorCode,
        statusCode: mapping?.statusCode || error?.statusCode || 500,
        details: {
          stack: error?.stack,
          meta: error?.meta,
          original: error?.message,
        },
      };
    }
    
    // In production, return sanitized error
    if (mapping) {
      return {
        error: mapping.message,
        code: errorCode,
        statusCode: mapping.statusCode,
      };
    }
    
    // Default error response for unknown errors
    return {
      error: 'An unexpected error occurred. Please try again later.',
      statusCode: error?.statusCode || 500,
    };
  }

  /**
   * Create a user-friendly error message
   */
  getUserMessage(error: any): string {
    const sanitized = this.sanitize(error);
    return sanitized.error;
  }

  /**
   * Get HTTP status code for error
   */
  getStatusCode(error: any): number {
    const sanitized = this.sanitize(error);
    return sanitized.statusCode;
  }

  /**
   * Format error for API response
   */
  formatApiError(error: any): { error: ErrorResponse; status: number } {
    const sanitized = this.sanitize(error);
    return {
      error: sanitized,
      status: sanitized.statusCode,
    };
  }

  /**
   * Handle async errors with proper logging
   */
  async handleAsync<T>(
    promise: Promise<T>,
    context?: string
  ): Promise<[T | null, ErrorResponse | null]> {
    try {
      const result = await promise;
      return [result, null];
    } catch (error) {
      logger.error(`Error in ${context || 'async operation'}`, error);
      const sanitized = this.sanitize(error);
      return [null, sanitized];
    }
  }

  /**
   * Create custom error
   */
  createError(code: string, message?: string, statusCode?: number): Error {
    const error = new Error(message || this.errorMappings[code]?.message || 'An error occurred');
    (error as any).code = code;
    (error as any).statusCode = statusCode || this.errorMappings[code]?.statusCode || 500;
    return error;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export class for custom instances
export { ErrorHandler };

// Export types
export type { ErrorResponse, ErrorMapping };