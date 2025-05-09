// setup.ts
import { beforeAll, afterAll } from 'vitest';

// Setup logic before all tests
beforeAll(() => {
    console.log('Setting up test environment...');
    process.env.RESEND_API_KEY = 'test-api-key'; // Example environment variable
});

// Cleanup logic after all tests
afterAll(() => {
    console.log('Cleaning up test environment...');
}); 