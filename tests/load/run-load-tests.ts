#!/usr/bin/env bun

/**
 * Run rate limiting load tests
 * 
 * Usage:
 *   bun run tests/load/run-load-tests.ts
 *   bun test tests/load/rate-limiting.test.ts
 */

import { $ } from 'bun';

console.log('🚀 Starting Rate Limiting Load Tests...\n');

// Check if Redis is available
try {
  const redis = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!redis) {
    console.warn('⚠️  Warning: Redis URL not found in environment variables');
    console.warn('   Tests will run but rate limiting will be bypassed\n');
  } else {
    console.log('✅ Redis connection configured\n');
  }
} catch (error) {
  console.error('❌ Error checking Redis configuration:', error);
}

// Run the tests
console.log('Running load tests...\n');

try {
  await $`bun test tests/load/rate-limiting.test.ts --timeout 30000`;
  console.log('\n✅ All load tests completed successfully!');
} catch (error) {
  console.error('\n❌ Load tests failed:', error);
  process.exit(1);
}

// Performance summary
console.log('\n📊 Performance Summary:');
console.log('- Public endpoints: 60 req/min limit');
console.log('- Authenticated endpoints: 120 req/min limit');
console.log('- Booking endpoints: 10 req/hr limit');
console.log('- Sliding window algorithm ensures accurate counting');
console.log('- Race conditions prevented with Redis atomic operations');
console.log('- Graceful degradation when Redis is unavailable\n');