import { cacheService, cacheConfigs } from './cache-service';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';

export interface CacheWarmingMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  keysWarmed: number;
  errors: string[];
  status: 'success' | 'partial' | 'failed';
}

export interface CacheWarmingOptions {
  warmPopularCars?: boolean;
  warmUpcomingAvailability?: boolean;
  popularCarsLimit?: number;
  availabilityDays?: number;
}

export class CacheWarmer {
  private supabase;
  private metrics: CacheWarmingMetrics;
  private readonly isBunRuntime: boolean;
  private isConfigured: boolean = false;

  constructor() {
    // Create a service role client for background operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      // Log warning but don't throw during build
      console.warn('Warning: Missing Supabase configuration for cache warmer. Cache warming will be disabled.');
      this.isConfigured = false;
      this.supabase = null;
    } else {
      this.isConfigured = true;
      this.supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
    
    this.metrics = this.initializeMetrics();
    this.isBunRuntime = typeof Bun !== 'undefined';
  }

  private initializeMetrics(): CacheWarmingMetrics {
    return {
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      keysWarmed: 0,
      errors: [],
      status: 'success'
    };
  }

  /**
   * Warm the cache with frequently accessed data
   */
  async warmCache(options: CacheWarmingOptions = {}): Promise<CacheWarmingMetrics> {
    if (!this.isConfigured) {
      console.warn('[CacheWarmer] Cache warming skipped - Supabase not configured');
      return {
        ...this.initializeMetrics(),
        endTime: new Date(),
        status: 'failed',
        errors: ['Supabase not configured']
      };
    }

    const {
      warmPopularCars = true,
      warmUpcomingAvailability = true,
      popularCarsLimit = 10,
      availabilityDays = 7
    } = options;

    this.metrics = this.initializeMetrics();
    console.log('[CacheWarmer] Starting cache warming...');

    // Use Bun's high-precision timer if available
    const startTime = this.isBunRuntime ? Bun.nanoseconds() : Date.now();

    try {
      const tasks: Promise<void>[] = [];

      if (warmPopularCars) {
        tasks.push(this.warmPopularCars(popularCarsLimit));
        tasks.push(this.warmFleetListing());
      }

      if (warmUpcomingAvailability) {
        tasks.push(this.warmUpcomingAvailability(availabilityDays));
      }

      // Execute all warming tasks in parallel
      await Promise.allSettled(tasks);

      this.metrics.endTime = new Date();
      
      // Calculate duration with high precision if using Bun
      if (this.isBunRuntime) {
        const endTime = Bun.nanoseconds();
        this.metrics.duration = Math.round((endTime - startTime) / 1_000_000); // Convert nanoseconds to milliseconds
      } else {
        this.metrics.duration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
      }

      // Determine overall status
      if (this.metrics.errors.length === 0) {
        this.metrics.status = 'success';
      } else if (this.metrics.keysWarmed > 0) {
        this.metrics.status = 'partial';
      } else {
        this.metrics.status = 'failed';
      }

      console.log(`[CacheWarmer] Cache warming completed in ${this.metrics.duration}ms`);
      console.log(`[CacheWarmer] Keys warmed: ${this.metrics.keysWarmed}`);
      console.log(`[CacheWarmer] Errors: ${this.metrics.errors.length}`);

      return this.metrics;
    } catch (error) {
      console.error('[CacheWarmer] Fatal error during cache warming:', error);
      this.metrics.errors.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
      this.metrics.status = 'failed';
      this.metrics.endTime = new Date();
      this.metrics.duration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
      return this.metrics;
    }
  }

  /**
   * Warm cache for the most popular cars based on booking count
   */
  private async warmPopularCars(limit: number): Promise<void> {
    if (!this.isConfigured) return;
    
    try {
      console.log(`[CacheWarmer] Warming ${limit} most popular cars...`);

      // Get popular cars from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // First, get booking counts per car
      const { data: bookingStats, error: statsError } = await this.supabase
        .from('bookings')
        .select('car_id')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('overall_status', 'in', '["cancelled", "failed"]');

      if (statsError) {
        throw new Error(`Failed to fetch booking stats: ${statsError.message}`);
      }

      // Count bookings per car
      const carBookingCounts = new Map<string, number>();
      bookingStats?.forEach(booking => {
        const count = carBookingCounts.get(booking.car_id) || 0;
        carBookingCounts.set(booking.car_id, count + 1);
      });

      // Sort by booking count and get top cars
      const popularCarIds = Array.from(carBookingCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([carId]) => carId);

      if (popularCarIds.length === 0) {
        console.log('[CacheWarmer] No popular cars found, fetching random active cars...');
        
        // Fallback: get random active cars
        const { data: cars, error: carsError } = await this.supabase
          .from('cars')
          .select('id')
          .eq('status', 'active')
          .eq('hidden', false)
          .limit(limit);

        if (carsError) {
          throw new Error(`Failed to fetch active cars: ${carsError.message}`);
        }

        cars?.forEach(car => popularCarIds.push(car.id));
      }

      // Warm car details for all popular cars in parallel using batches
      // Use smaller batches to avoid overwhelming the database
      const batchSize = 5;
      for (let i = 0; i < popularCarIds.length; i += batchSize) {
        const batch = popularCarIds.slice(i, i + batchSize);
        await Promise.all(batch.map(carId => this.warmCarDetails(carId)));
      }

      console.log(`[CacheWarmer] Warmed ${popularCarIds.length} popular cars`);
    } catch (error) {
      const errorMessage = `Error warming popular cars: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[CacheWarmer] ${errorMessage}`);
      this.metrics.errors.push(errorMessage);
    }
  }

  /**
   * Warm cache for individual car details
   */
  private async warmCarDetails(carId: string): Promise<void> {
    if (!this.isConfigured) return;
    
    try {
      const cacheKey = cacheService.generateCacheKey(
        cacheConfigs.carDetails.keyPrefix,
        carId
      );

      // Fetch car details
      const { data: car, error } = await this.supabase
        .from('cars')
        .select(`
          *,
          category:categories(
            id,
            name,
            slug,
            description
          )
        `)
        .eq('id', carId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch car ${carId}: ${error.message}`);
      }

      if (car) {
        await cacheService.set(cacheKey, car, cacheConfigs.carDetails.ttl);
        this.metrics.keysWarmed++;
      }
    } catch (error) {
      const errorMessage = `Error warming car ${carId}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[CacheWarmer] ${errorMessage}`);
      this.metrics.errors.push(errorMessage);
    }
  }

  /**
   * Warm cache for fleet listing
   */
  private async warmFleetListing(): Promise<void> {
    if (!this.isConfigured) return;
    
    try {
      console.log('[CacheWarmer] Warming fleet listing...');
      
      const cacheKey = cacheService.generateCacheKey(
        cacheConfigs.fleetListing.keyPrefix,
        'all'
      );

      // Fetch all cars
      const { data: cars, error } = await this.supabase
        .from('cars')
        .select(`
          *,
          category:categories(
            id,
            name,
            slug,
            description
          )
        `)
        .eq('hidden', false)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch fleet listing: ${error.message}`);
      }

      const responseData = {
        success: true,
        cars: cars || [],
        count: cars?.length || 0
      };

      await cacheService.set(cacheKey, responseData, cacheConfigs.fleetListing.ttl);
      this.metrics.keysWarmed++;
      
      console.log(`[CacheWarmer] Warmed fleet listing with ${cars?.length || 0} cars`);
    } catch (error) {
      const errorMessage = `Error warming fleet listing: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[CacheWarmer] ${errorMessage}`);
      this.metrics.errors.push(errorMessage);
    }
  }

  /**
   * Warm cache for upcoming availability of popular cars
   */
  private async warmUpcomingAvailability(days: number): Promise<void> {
    if (!this.isConfigured) return;
    
    try {
      console.log(`[CacheWarmer] Warming availability for next ${days} days...`);

      // Get popular car IDs (reuse logic from warmPopularCars)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: bookingStats, error: statsError } = await this.supabase
        .from('bookings')
        .select('car_id')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('overall_status', 'in', '["cancelled", "failed"]');

      if (statsError) {
        throw new Error(`Failed to fetch booking stats: ${statsError.message}`);
      }

      const carBookingCounts = new Map<string, number>();
      bookingStats?.forEach(booking => {
        const count = carBookingCounts.get(booking.car_id) || 0;
        carBookingCounts.set(booking.car_id, count + 1);
      });

      const popularCarIds = Array.from(carBookingCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([carId]) => carId);

      // Generate date range
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Warm availability for all popular cars in parallel using batches
      const batchSize = 5;
      for (let i = 0; i < popularCarIds.length; i += batchSize) {
        const batch = popularCarIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(carId => this.warmCarAvailability(carId, startDateStr, endDateStr))
        );
      }

      console.log(`[CacheWarmer] Warmed availability for ${popularCarIds.length} cars`);
    } catch (error) {
      const errorMessage = `Error warming upcoming availability: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[CacheWarmer] ${errorMessage}`);
      this.metrics.errors.push(errorMessage);
    }
  }

  /**
   * Warm cache for car availability
   */
  private async warmCarAvailability(carId: string, startDate: string, endDate: string): Promise<void> {
    if (!this.isConfigured) return;
    
    try {
      const cacheKey = cacheService.generateCacheKey(
        cacheConfigs.carAvailability.keyPrefix,
        carId,
        startDate,
        endDate
      );

      // Query car_availability table
      const { data: availabilityData, error: availabilityError } = await this.supabase
        .from('car_availability')
        .select('date, status')
        .eq('car_id', carId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (availabilityError) {
        throw new Error(`Failed to fetch availability: ${availabilityError.message}`);
      }

      // Create availability map
      const availabilityMap = new Map<string, string>();
      availabilityData?.forEach(record => {
        availabilityMap.set(record.date, record.status);
      });

      // Generate availability array
      const availability: Array<{
        date: string;
        available: boolean;
        status: string;
      }> = [];
      
      const currentDate = new Date(startDate);
      const end = new Date(endDate);
      
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const status = availabilityMap.get(dateStr) || 'available';
        
        availability.push({
          date: dateStr,
          available: status === 'available',
          status: status
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Also check for active bookings
      const { data: bookings } = await this.supabase
        .from('bookings')
        .select('id, start_date, end_date, overall_status')
        .eq('car_id', carId)
        .gte('end_date', startDate)
        .lte('start_date', endDate)
        .not('overall_status', 'in', '["cancelled", "failed"]');

      // Mark booked dates
      bookings?.forEach(booking => {
        const bookingStart = new Date(booking.start_date);
        const bookingEnd = new Date(booking.end_date);
        
        availability.forEach(day => {
          const dayDate = new Date(day.date);
          if (dayDate >= bookingStart && dayDate <= bookingEnd) {
            day.available = false;
            day.status = 'booked';
          }
        });
      });

      const responseData = {
        carId,
        startDate,
        endDate,
        availability,
        summary: {
          totalDays: availability.length,
          availableDays: availability.filter(d => d.available).length,
          unavailableDays: availability.filter(d => !d.available).length
        }
      };

      await cacheService.set(cacheKey, responseData, cacheConfigs.carAvailability.ttl);
      this.metrics.keysWarmed++;
    } catch (error) {
      const errorMessage = `Error warming availability for car ${carId}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[CacheWarmer] ${errorMessage}`);
      this.metrics.errors.push(errorMessage);
    }
  }

  /**
   * Get the last warming metrics
   */
  getMetrics(): CacheWarmingMetrics {
    return { ...this.metrics };
  }

  /**
   * Warm cache on startup (non-blocking)
   */
  async warmOnStartup(options: CacheWarmingOptions = {}): Promise<void> {
    if (!this.isConfigured) {
      console.warn('[CacheWarmer] Startup cache warming skipped - Supabase not configured');
      return;
    }
    
    if (this.isBunRuntime) {
      // Use Bun's process.nextTick equivalent for non-blocking execution
      queueMicrotask(async () => {
        console.log('[CacheWarmer] Starting background cache warming on startup...');
        try {
          await this.warmCache(options);
        } catch (error) {
          console.error('[CacheWarmer] Error during startup cache warming:', error);
        }
      });
    } else {
      // Use setImmediate for Node.js or setTimeout as fallback
      const schedule = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout;
      schedule(async () => {
        console.log('[CacheWarmer] Starting background cache warming on startup...');
        try {
          await this.warmCache(options);
        } catch (error) {
          console.error('[CacheWarmer] Error during startup cache warming:', error);
        }
      }, 0);
    }
  }
}

// Export singleton instance
export const cacheWarmer = new CacheWarmer();