// Test setup file for Bun tests
import { beforeAll, afterAll } from 'bun:test';

// Configure test environment
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Mock environment variables that might be needed
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://test-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'test-token';

// Global test setup
beforeAll(() => {
  // Any global setup needed before all tests
  console.log('Starting error handling tests...');
});

// Global test teardown
afterAll(() => {
  // Any global cleanup needed after all tests
  console.log('Error handling tests completed.');
});

// Extend Bun test matchers if needed
declare module 'bun:test' {
  interface Matchers<T> {
    toBeValidErrorResponse?(): void;
  }
}

// Add custom matchers if needed
// expect.extend({
//   toBeValidErrorResponse(received) {
//     // Custom matcher implementation
//   }
// });