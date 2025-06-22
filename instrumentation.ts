/**
 * Next.js instrumentation file
 * This runs once when the server starts
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting...');
    
    // Optional cache warming on startup
    if (process.env.CACHE_WARM_ON_STARTUP === 'true') {
      console.log('[Instrumentation] Cache warming enabled on startup');
      
      // Import dynamically to avoid issues with edge runtime
      const { cacheWarmer } = await import('./lib/redis/cache-warmer');
      
      // Perform cache warming in the background
      setTimeout(async () => {
        try {
          console.log('[Instrumentation] Starting background cache warming...');
          const metrics = await cacheWarmer.warmCache({
            warmPopularCars: true,
            warmUpcomingAvailability: true,
            popularCarsLimit: 10,
            availabilityDays: 7
          });
          
          console.log('[Instrumentation] Cache warming completed:', {
            duration: `${metrics.duration}ms`,
            keysWarmed: metrics.keysWarmed,
            status: metrics.status
          });
        } catch (error) {
          console.error('[Instrumentation] Cache warming failed:', error);
        }
      }, 5000); // Wait 5 seconds after startup to allow services to initialize
    }
  }
}