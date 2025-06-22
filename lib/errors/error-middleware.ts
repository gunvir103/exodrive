import { NextRequest, NextResponse } from 'next/server';
import { handleError, withErrorHandler } from './error-handler';

// Middleware to wrap API route handlers with error handling
export function withApiErrorHandling<T extends any[], R>(
  handler: (req: NextRequest, ...args: T) => Promise<R>
) {
  return async (req: NextRequest, ...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      return handleError(error, req);
    }
  };
}

// Combined middleware for caching, rate limiting, and error handling
export function createApiHandler<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
  options?: {
    cache?: boolean;
    rateLimit?: boolean;
    auth?: boolean;
  }
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Here we can compose multiple middlewares
      let wrappedHandler = handler;
      
      // Add middlewares based on options
      // This is a simplified version - in practice, you'd import and use the actual middleware functions
      
      return await wrappedHandler(req, ...args);
    } catch (error) {
      return handleError(error, req);
    }
  };
}