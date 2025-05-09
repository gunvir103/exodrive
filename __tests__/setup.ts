// __tests__/setup.ts
console.log('Test setup file loaded successfully.');

// Setup logic before all tests
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
    console.log('Setting up test environment...');
    process.env.RESEND_API_KEY = 'test-api-key'; // Example environment variable
});

// Cleanup logic after all tests
afterAll(() => {
    console.log('Cleaning up test environment...');
}); 