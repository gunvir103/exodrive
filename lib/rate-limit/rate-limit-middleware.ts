import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, RateLimitConfig, rateLimitConfigs } from './rate-limiter';
import { ApiError, errors } from '../errors/api-error';

export interface RateLimitMiddlewareOptions {
  config: RateLimitConfig;
  identifierExtractor: (req: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onRateLimited?: (req: NextRequest, retryAfter: number) => void;
}

function getClientIp(req: NextRequest): string {
  // Try to get IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a default if no IP is found
  return 'unknown';
}

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RateLimitMiddlewareOptions
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { config, identifierExtractor, onRateLimited } = options;
    
    // Skip rate limiting if Redis is not available
    if (!rateLimiter.isAvailable()) {
      console.warn('[RateLimitMiddleware] Redis not available, bypassing rate limit');
      return handler(req);
    }

    const identifier = identifierExtractor(req);
    const result = await rateLimiter.checkLimit(identifier, config);

    // Always set rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      headers.set('Retry-After', result.retryAfter!.toString());
      
      // Call onRateLimited callback if provided
      if (onRateLimited) {
        onRateLimited(req, result.retryAfter!);
      }

      throw errors.rateLimited(result.retryAfter!);
    }

    // Execute the handler
    const response = await handler(req);

    // Copy rate limit headers to response
    headers.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

// Pre-configured rate limit middlewares
export const publicRateLimit = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return withRateLimit(handler, {
    config: rateLimitConfigs.public,
    identifierExtractor: (req) => getClientIp(req),
  });
};

export const authenticatedRateLimit = (userId: string) => {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return withRateLimit(handler, {
      config: rateLimitConfigs.authenticated,
      identifierExtractor: () => userId,
    });
  };
};

export const bookingRateLimit = (userId: string) => {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return withRateLimit(handler, {
      config: rateLimitConfigs.booking,
      identifierExtractor: (req) => userId || getClientIp(req),
    });
  };
};

// Helper to extract user ID from session/token
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  // This is a placeholder - implement based on your auth strategy
  // For example, extract from JWT token, session cookie, etc.
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  // TODO: Validate token and extract user ID
  // const token = authHeader.substring(7);
  // const decoded = await verifyToken(token);
  // return decoded.userId;
  
  return null;
}

// Dynamic rate limit based on authentication status
export const dynamicRateLimit = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return async (req: NextRequest): Promise<NextResponse> => {
    const userId = await getUserIdFromRequest(req);
    
    if (userId) {
      // Use authenticated rate limit
      return withRateLimit(handler, {
        config: rateLimitConfigs.authenticated,
        identifierExtractor: () => userId,
      })(req);
    } else {
      // Use public rate limit
      return withRateLimit(handler, {
        config: rateLimitConfigs.public,
        identifierExtractor: (req) => getClientIp(req),
      })(req);
    }
  };
};