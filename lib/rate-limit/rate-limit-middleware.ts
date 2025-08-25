import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, RateLimitConfig, rateLimitConfigs } from './rate-limiter';
import { ApiError, errors } from '../errors/api-error';

export interface RateLimitMiddlewareOptions {
  config: RateLimitConfig;
  identifierExtractor: (req: NextRequest) => string | Promise<string>;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onRateLimited?: (req: NextRequest, retryAfter: number) => void;
  dualLimitExtractor?: (req: NextRequest) => Promise<{ ip: string; userId?: string }>; // For dual rate limiting
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
    const { config, identifierExtractor, onRateLimited, dualLimitExtractor } = options;
    
    // Skip rate limiting if Redis is not available
    if (!rateLimiter.isAvailable()) {
      console.warn('[RateLimitMiddleware] Redis not available, bypassing rate limit');
      return handler(req);
    }

    let result: RateLimitResult;

    // Handle dual rate limiting if enabled
    if (config.enableDualLimit && dualLimitExtractor) {
      const { ip, userId } = await dualLimitExtractor(req);
      
      // Check IP-based limit first
      const ipResult = await rateLimiter.checkLimit(ip, {
        ...config,
        keyGenerator: (id) => `${config.keyGenerator(id)}:ip`,
      });
      
      if (!ipResult.allowed) {
        result = ipResult;
      } else if (userId) {
        // If IP limit passed and we have a user ID, check user-based limit
        const userResult = await rateLimiter.checkLimit(userId, {
          ...config,
          keyGenerator: (id) => `${config.keyGenerator(id)}:user`,
        });
        result = userResult;
      } else {
        result = ipResult;
      }
    } else {
      // Single rate limit check
      const identifier = await identifierExtractor(req);
      result = await rateLimiter.checkLimit(identifier, config);
    }

    // Always set rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      headers.set('Retry-After', result.retryAfter!.toString());
      
      // Track the violation
      rateLimitViolationHandler.addViolation({
        timestamp: new Date(),
        identifier: await identifierExtractor(req),
        endpoint: req.url,
        limit: result.limit,
        windowMs: config.windowMs,
        headers: Object.fromEntries(req.headers.entries()),
      });
      
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
  // Check for Authorization header with Bearer token
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    // Extract the token
    const token = authHeader.substring(7);
    
    // For Supabase, we need to verify the JWT token
    // The token contains the user ID in the 'sub' claim
    // We'll use the Supabase client to verify the token
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Verify the token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('[RateLimit] Token validation failed:', error?.message);
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('[RateLimit] Error validating token:', error);
    return null;
  }
}

// Pre-configured rate limiters for specific endpoints
export const paymentRateLimit = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return withRateLimit(handler, {
    config: rateLimitConfigs.paymentEndpoints,
    identifierExtractor: (req) => getClientIp(req),
    dualLimitExtractor: async (req) => {
      const ip = getClientIp(req);
      const userId = await getUserIdFromRequest(req);
      return { ip, userId: userId || undefined };
    },
    onRateLimited: (req, retryAfter) => {
      console.error(`[RateLimitMiddleware] Payment endpoint rate limited: ${req.url}, retry after ${retryAfter}s`);
    },
  });
};

export const uploadRateLimit = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return withRateLimit(handler, {
    config: rateLimitConfigs.carUpload,
    identifierExtractor: async (req) => {
      const userId = await getUserIdFromRequest(req);
      return userId || getClientIp(req); // Fallback to IP if no user ID
    },
    onRateLimited: (req, retryAfter) => {
      console.error(`[RateLimitMiddleware] Upload endpoint rate limited: ${req.url}, retry after ${retryAfter}s`);
    },
  });
};

export const webhookRateLimit = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return withRateLimit(handler, {
    config: rateLimitConfigs.webhook,
    identifierExtractor: (req) => {
      // Use source IP for webhooks
      return getClientIp(req);
    },
  });
};

export const adminRateLimit = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return withRateLimit(handler, {
    config: rateLimitConfigs.admin,
    identifierExtractor: async (req) => {
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        throw new Error('Admin endpoints require authentication');
      }
      return userId;
    },
  });
};

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

// Rate limit monitoring types
export interface RateLimitViolation {
  timestamp: Date;
  identifier: string;
  endpoint: string;
  limit: number;
  windowMs: number;
  headers: Record<string, string>;
}

// Global rate limit violation handler
export const rateLimitViolationHandler = {
  violations: [] as RateLimitViolation[],
  maxViolations: 1000, // Keep last 1000 violations in memory
  
  addViolation(violation: RateLimitViolation) {
    this.violations.push(violation);
    if (this.violations.length > this.maxViolations) {
      this.violations.shift(); // Remove oldest
    }
    
    // Log to monitoring service
    console.error('[RateLimitViolation]', {
      timestamp: violation.timestamp.toISOString(),
      identifier: violation.identifier,
      endpoint: violation.endpoint,
      limit: violation.limit,
      window: `${violation.windowMs}ms`,
    });
    
    // Send to external monitoring service (e.g., Sentry, DataDog) when configured
    // Example: sendToMonitoring(violation);
  },
  
  getRecentViolations(minutes: number = 60): RateLimitViolation[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.violations.filter(v => v.timestamp > cutoff);
  },
  
  getViolationsByIdentifier(identifier: string): RateLimitViolation[] {
    return this.violations.filter(v => v.identifier === identifier);
  },
  
  clearViolations() {
    this.violations = [];
  },
};