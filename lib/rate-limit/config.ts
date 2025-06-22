/**
 * Centralized rate limit configuration for ExoDrive
 */

import { RateLimitConfig } from './rate-limiter'

/**
 * Rate limit configurations for different endpoints and scenarios
 */
export const rateLimitConfig = {
  // Public endpoints
  public: {
    default: {
      limit: 60,
      window: 60, // 60 requests per minute
      namespace: 'rl:public',
    },
    search: {
      limit: 30,
      window: 60, // 30 searches per minute
      namespace: 'rl:public:search',
    },
    carDetails: {
      limit: 100,
      window: 60, // 100 car detail views per minute
      namespace: 'rl:public:cars',
    },
  },

  // Authenticated endpoints
  authenticated: {
    default: {
      limit: 120,
      window: 60, // 120 requests per minute
      namespace: 'rl:auth',
    },
    profile: {
      limit: 60,
      window: 60, // 60 profile updates per minute
      namespace: 'rl:auth:profile',
    },
    reviews: {
      limit: 5,
      window: 300, // 5 reviews per 5 minutes
      namespace: 'rl:auth:reviews',
    },
  },

  // Booking-related endpoints
  booking: {
    creation: {
      limit: 10,
      window: 3600, // 10 booking attempts per hour
      namespace: 'rl:booking:create',
    },
    availability: {
      limit: 60,
      window: 60, // 60 availability checks per minute
      namespace: 'rl:booking:availability',
    },
    payment: {
      limit: 5,
      window: 300, // 5 payment attempts per 5 minutes
      namespace: 'rl:booking:payment',
    },
  },

  // Admin endpoints
  admin: {
    default: {
      limit: 300,
      window: 60, // 300 requests per minute for admins
      namespace: 'rl:admin',
    },
    reports: {
      limit: 10,
      window: 60, // 10 report generations per minute
      namespace: 'rl:admin:reports',
    },
    bulkOperations: {
      limit: 5,
      window: 300, // 5 bulk operations per 5 minutes
      namespace: 'rl:admin:bulk',
    },
  },

  // API endpoints for external integrations
  api: {
    webhooks: {
      limit: 100,
      window: 60, // 100 webhook calls per minute
      namespace: 'rl:api:webhooks',
    },
    upload: {
      limit: 20,
      window: 300, // 20 uploads per 5 minutes
      namespace: 'rl:api:upload',
    },
  },

  // Special rate limits
  special: {
    emailVerification: {
      limit: 3,
      window: 3600, // 3 verification emails per hour
      namespace: 'rl:special:email-verify',
    },
    passwordReset: {
      limit: 3,
      window: 3600, // 3 password reset attempts per hour
      namespace: 'rl:special:password-reset',
    },
    contactForm: {
      limit: 5,
      window: 3600, // 5 contact form submissions per hour
      namespace: 'rl:special:contact',
    },
  },
} as const

/**
 * Get rate limit configuration by path
 */
export function getRateLimitConfigByPath(path: string): RateLimitConfig | null {
  // Map API paths to rate limit configurations
  const pathMappings: Record<string, RateLimitConfig> = {
    // Public routes
    '/api/cars': rateLimitConfig.public.default,
    '/api/cars/availability': rateLimitConfig.booking.availability,
    '/api/hero-content': rateLimitConfig.public.default,
    
    // Booking routes
    '/api/bookings': rateLimitConfig.booking.creation,
    '/api/bookings/create-paypal-order': rateLimitConfig.booking.payment,
    '/api/bookings/authorize-paypal-order': rateLimitConfig.booking.payment,
    '/api/bookings/capture-payment': rateLimitConfig.booking.payment,
    '/api/bookings/void-payment': rateLimitConfig.booking.payment,
    
    // Email routes
    '/api/email/contact': rateLimitConfig.special.contactForm,
    '/api/email/booking': rateLimitConfig.special.emailVerification,
    
    // Admin routes
    '/api/admin/bookings': rateLimitConfig.admin.default,
    '/api/admin/cars': rateLimitConfig.admin.default,
    '/api/admin/analytics': rateLimitConfig.admin.reports,
    '/api/admin/inbox': rateLimitConfig.admin.default,
    
    // Upload routes
    '/api/cars/upload': rateLimitConfig.api.upload,
    '/api/upload-placeholder': rateLimitConfig.api.upload,
    
    // Webhook routes
    '/api/webhooks/paypal': rateLimitConfig.api.webhooks,
    '/api/webhooks/docuseal': rateLimitConfig.api.webhooks,
    '/api/webhooks/resend': rateLimitConfig.api.webhooks,
  }

  // Check for exact match
  if (pathMappings[path]) {
    return pathMappings[path]
  }

  // Check for pattern matches
  if (path.startsWith('/api/admin/')) {
    return rateLimitConfig.admin.default
  }
  
  if (path.startsWith('/api/webhooks/')) {
    return rateLimitConfig.api.webhooks
  }
  
  if (path.includes('/reviews')) {
    return rateLimitConfig.authenticated.reviews
  }

  // Default to public rate limit
  return rateLimitConfig.public.default
}

/**
 * Environment-based rate limit multipliers
 */
export const environmentMultipliers = {
  development: 10, // 10x higher limits in development
  staging: 2, // 2x higher limits in staging
  production: 1, // Normal limits in production
} as const

/**
 * Apply environment multiplier to rate limit config
 */
export function applyEnvironmentMultiplier(
  config: RateLimitConfig,
  environment: keyof typeof environmentMultipliers = 'production'
): RateLimitConfig {
  const multiplier = environmentMultipliers[environment]
  return {
    ...config,
    limit: config.limit * multiplier,
  }
}