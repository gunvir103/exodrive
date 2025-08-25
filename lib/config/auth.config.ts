/**
 * Authentication Configuration
 * Centralized configuration for all authentication-related constants
 */

export const AUTH_CONFIG = {
  // Timeout configurations in milliseconds
  TIMEOUTS: {
    PROFILE_QUERY: 5000,        // Timeout for profile database queries
    AUTH_LOADING: 15000,        // Maximum time to wait for auth loading
    AUTH_STATE_CHANGE: 3000,    // Timeout for auth state changes
    SESSION_REFRESH: 10000,     // Session refresh timeout
  },
  
  // Retry configurations
  RETRIES: {
    MAX_ATTEMPTS: 3,            // Maximum retry attempts
    BACKOFF_BASE: 1000,         // Base backoff time in ms
    BACKOFF_MAX: 10000,         // Maximum backoff time
  },
  
  // Cache configurations
  CACHE: {
    ADMIN_STATUS_TTL: 300000,   // 5 minutes cache for admin status
    SESSION_TTL: 3600000,       // 1 hour session cache
  },
  
  // Security configurations
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,      // Max login attempts before lockout
    LOCKOUT_DURATION: 900000,   // 15 minutes lockout
    TOKEN_LENGTH: 48,           // Secure token length
  },
} as const;

// Type for the configuration
export type AuthConfig = typeof AUTH_CONFIG;