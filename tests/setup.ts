// Global test setup
import { beforeAll, afterAll } from "bun:test";

// Set test environment variables
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  configurable: true
});
Object.defineProperty(process.env, 'NEXT_PUBLIC_BASE_URL', {
  value: 'http://localhost:3005',
  writable: true,
  configurable: true
});

// Mock console methods to reduce noise during tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

// Optionally suppress console output during tests
if (process.env.QUIET_TESTS === "true") {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  // Keep error logs for debugging
}

// Global setup
beforeAll(() => {
  // Any global setup needed for all tests
  console.info("🧪 Running tests...");
});

// Global teardown
afterAll(() => {
  // Restore console methods
  if (process.env.QUIET_TESTS === "true") {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
  }
});

// Export mock utilities
export * from "./mocks/supabase";
export * from "./mocks/paypal";
export * from "./mocks/redis";
export * from "./mocks/email";