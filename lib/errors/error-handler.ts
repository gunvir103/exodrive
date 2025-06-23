import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ErrorCodes, ErrorResponse } from './api-error';
import { ZodError } from 'zod';
import crypto from 'crypto';

function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Safe JSON stringify to handle circular references
function safeStringify(obj: any): any {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return value;
  }));
}

export function handleError(
  error: unknown,
  req?: NextRequest
): NextResponse {
  const traceId = req?.headers.get('x-trace-id') || generateTraceId();
  
  // Log error with context
  console.error('[ErrorHandler]', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    traceId,
    method: req?.method,
    url: req?.url,
    timestamp: new Date().toISOString(),
  });

  // Handle ApiError
  if (error instanceof ApiError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details ? safeStringify(error.details) : undefined,
        timestamp: error.timestamp,
        traceId,
      },
      status: error.status,
    };

    return NextResponse.json(errorResponse, { 
      status: error.status,
      headers: {
        'X-Trace-Id': traceId,
      },
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: error.flatten(),
        timestamp: new Date().toISOString(),
        traceId,
      },
      status: 400,
    };

    return NextResponse.json(errorResponse, { 
      status: 400,
      headers: {
        'X-Trace-Id': traceId,
      },
    });
  }

  // Handle Supabase errors
  if (error instanceof Error && error.message.includes('PGRST')) {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCodes.DATABASE_ERROR,
        message: 'Database operation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
        traceId,
      },
      status: 500,
    };

    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'X-Trace-Id': traceId,
      },
    });
  }

  // Handle generic errors
  const errorResponse: ErrorResponse = {
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' && error instanceof Error 
        ? { message: error.message, stack: error.stack }
        : undefined,
      timestamp: new Date().toISOString(),
      traceId,
    },
    status: 500,
  };

  return NextResponse.json(errorResponse, { 
    status: 500,
    headers: {
      'X-Trace-Id': traceId,
    },
  });
}

// Async error wrapper for Next.js API routes
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Find NextRequest in args
      const req = args.find((arg): arg is NextRequest => 
        arg instanceof NextRequest || 
        (typeof arg === 'object' && arg !== null && 'method' in arg && 'url' in arg)
      );
      
      return handleError(error, req);
    }
  };
}

// Error boundary for async functions
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => T | Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorHandler) {
      return errorHandler(error);
    }
    throw error;
  }
}

// Format error for logging
export function formatError(error: unknown): Record<string, any> {
  if (error instanceof ApiError) {
    return {
      type: 'ApiError',
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    type: 'Unknown',
    error: String(error),
  };
}