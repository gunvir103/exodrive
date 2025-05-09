/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Or 'jsdom' if you're testing browser-like environments
    // If you have a setup file you want to use, you can specify it here:
    // setupFiles: './path/to/your/setup.ts',
    include: ['**/__tests__/**/*.test.ts'], // Matches your Jest config
    alias: { // Matches your Jest moduleNameMapper
      '@/': new URL('./', import.meta.url).pathname,
    },
  },
}); 