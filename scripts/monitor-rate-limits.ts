#!/usr/bin/env bun

import { rateLimiter, rateLimitConfigs } from '../lib/rate-limit/rate-limiter';
import { getRateLimitStatus } from '../lib/rate-limit/rate-limit-testing';

/**
 * Monitor rate limits in real-time
 * Usage: bun run scripts/monitor-rate-limits.ts
 */

// Test identifiers to monitor
const monitoringConfigs = [
  {
    name: 'Payment Endpoints (IP)',
    identifier: '192.168.1.100',
    config: rateLimitConfigs.paymentEndpoints,
  },
  {
    name: 'Payment Endpoints (User)',
    identifier: 'user-123',
    config: rateLimitConfigs.paymentEndpoints,
  },
  {
    name: 'Upload Endpoint',
    identifier: 'user-456',
    config: rateLimitConfigs.carUpload,
  },
  {
    name: 'Webhook Endpoint',
    identifier: '10.0.0.1',
    config: rateLimitConfigs.webhook,
  },
  {
    name: 'Admin Endpoint',
    identifier: 'admin-789',
    config: rateLimitConfigs.admin,
  },
];

async function displayRateLimitStatus() {
  console.clear();
  console.log('=== ExoDrive Rate Limit Monitor ===');
  console.log(`Time: ${new Date().toLocaleTimeString()}`);
  console.log('');

  for (const { name, identifier, config } of monitoringConfigs) {
    try {
      const status = await getRateLimitStatus(identifier, config);
      const barLength = 20;
      const filledLength = Math.round((status.percentUsed / 100) * barLength);
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
      
      console.log(`${name}`);
      console.log(`  Identifier: ${identifier}`);
      console.log(`  Status: ${status.remaining}/${status.limit} remaining`);
      console.log(`  Usage:  [${bar}] ${status.percentUsed}%`);
      
      if (status.percentUsed > 80) {
        console.log(`  ⚠️  WARNING: High usage detected!`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`${name}: Error - ${error.message}`);
      console.log('');
    }
  }

  console.log('Press Ctrl+C to exit');
}

// Simulate some traffic (optional - comment out in production)
async function simulateTraffic() {
  const configs = [
    { identifier: '192.168.1.100', config: rateLimitConfigs.paymentEndpoints },
    { identifier: 'user-456', config: rateLimitConfigs.carUpload },
  ];

  for (const { identifier, config } of configs) {
    // Random chance to make a request
    if (Math.random() < 0.3) {
      await rateLimiter.checkLimit(identifier, config);
    }
  }
}

// Main monitoring loop
async function monitor() {
  if (!rateLimiter.isAvailable()) {
    console.error('Redis is not available. Rate limit monitoring requires Redis.');
    process.exit(1);
  }

  setInterval(async () => {
    await displayRateLimitStatus();
    
    // Uncomment to simulate traffic
    // await simulateTraffic();
  }, 1000); // Update every second

  // Initial display
  await displayRateLimitStatus();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down rate limit monitor...');
  process.exit(0);
});

// Start monitoring
monitor().catch(error => {
  console.error('Failed to start rate limit monitor:', error);
  process.exit(1);
});