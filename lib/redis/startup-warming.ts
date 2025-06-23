/**
 * Cache warming on startup configuration
 * Import this module in your app initialization to enable cache warming on startup
 */

import { cacheWarmer } from './cache-warmer';

// Check if cache warming on startup is enabled via environment variable
const ENABLE_STARTUP_WARMING = process.env.ENABLE_CACHE_WARMING_ON_STARTUP === 'true';
const STARTUP_WARMING_DELAY = parseInt(process.env.CACHE_WARMING_STARTUP_DELAY || '5000', 10);

export function initializeCacheWarming() {
  if (!ENABLE_STARTUP_WARMING) {
    console.log('[StartupWarming] Cache warming on startup is disabled');
    return;
  }

  // Delay the warming to allow the server to fully start
  setTimeout(() => {
    console.log('[StartupWarming] Initiating cache warming on startup...');
    
    cacheWarmer.warmOnStartup({
      warmPopularCars: true,
      warmUpcomingAvailability: true,
      popularCarsLimit: 10,
      availabilityDays: 7
    });
  }, STARTUP_WARMING_DELAY);
}

// Auto-initialize if this module is imported
if (typeof window === 'undefined') {
  // Only run on server-side
  initializeCacheWarming();
}