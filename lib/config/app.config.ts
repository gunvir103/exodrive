/**
 * Application Configuration
 * Centralized configuration for application-wide constants
 */

export const APP_CONFIG = {
  // Redis configurations
  REDIS: {
    LOCK_TTL: 30,               // Lock TTL in seconds
    CONNECTION_RETRIES: 3,      // Max connection retries
    RETRY_DELAY: 1000,          // Retry delay in ms
  },
  
  // API configurations
  API: {
    RATE_LIMIT_WINDOW: 60000,   // 1 minute rate limit window
    RATE_LIMIT_MAX_REQUESTS: 60, // Max requests per window
    REQUEST_TIMEOUT: 30000,     // 30 seconds request timeout
  },
  
  // Database configurations
  DATABASE: {
    QUERY_TIMEOUT: 10000,       // 10 seconds query timeout
    MAX_RETRIES: 3,             // Max database retry attempts
    CONNECTION_POOL_SIZE: 10,   // Connection pool size
  },
  
  // Validation patterns
  VALIDATION: {
    DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
    EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_PATTERN: /^\+?[\d\s-()]+$/,
    UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },
  
  // Feature flags
  FEATURES: {
    ENABLE_REDIS_CACHE: process.env.ENABLE_REDIS_CACHE === 'true',
    ENABLE_DETAILED_LOGGING: process.env.NODE_ENV === 'development',
    ENABLE_ERROR_TRACKING: process.env.NODE_ENV === 'production',
  },
} as const;

// Type for the configuration
export type AppConfig = typeof APP_CONFIG;