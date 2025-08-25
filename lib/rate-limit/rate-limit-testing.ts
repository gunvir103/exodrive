import { rateLimiter, RateLimitConfig } from './rate-limiter';

/**
 * Utility functions for testing rate limits
 */

export async function testRateLimit(
  identifier: string,
  config: RateLimitConfig,
  requestCount: number = 20
): Promise<{
  allowed: number;
  blocked: number;
  firstBlockedAt: number | null;
}> {
  let allowed = 0;
  let blocked = 0;
  let firstBlockedAt: number | null = null;

  for (let i = 0; i < requestCount; i++) {
    const result = await rateLimiter.checkLimit(identifier, config);
    
    if (result.allowed) {
      allowed++;
    } else {
      blocked++;
      if (firstBlockedAt === null) {
        firstBlockedAt = i + 1;
      }
    }
    
    // Small delay to simulate real requests
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return { allowed, blocked, firstBlockedAt };
}

export async function resetRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<boolean> {
  return rateLimiter.reset(identifier, config);
}

export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<{
  remaining: number;
  limit: number;
  percentUsed: number;
}> {
  const remaining = await rateLimiter.getRemainingRequests(identifier, config);
  const limit = config.max;
  const used = limit - remaining;
  const percentUsed = (used / limit) * 100;

  return {
    remaining,
    limit,
    percentUsed: Math.round(percentUsed),
  };
}

// Example usage in tests or monitoring scripts
export async function monitorRateLimits() {
  const configs = [
    { name: 'Payment Endpoints', identifier: '192.168.1.1', config: { windowMs: 60000, max: 10, keyGenerator: (id: string) => `rate:payment:${id}` } },
    { name: 'Upload Endpoints', identifier: 'user123', config: { windowMs: 60000, max: 5, keyGenerator: (id: string) => `rate:upload:${id}` } },
  ];

  for (const { name, identifier, config } of configs) {
    const status = await getRateLimitStatus(identifier, config);
    console.log(`${name} - ${identifier}:`);
    console.log(`  Remaining: ${status.remaining}/${status.limit} (${status.percentUsed}% used)`);
  }
}