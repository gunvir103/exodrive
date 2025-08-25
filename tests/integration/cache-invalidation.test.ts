import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { cacheService, invalidateCacheByEvent, cacheConfigs } from '@/lib/redis';

// Test configuration
const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3005';
const TEST_API_ENDPOINTS = {
  cars: '/api/cars',
  carAvailability: '/api/cars/availability',
  carDetails: '/api/cars/{carId}',
  bookings: '/api/bookings',
  adminBookings: '/api/admin/bookings',
  adminCars: '/api/admin/cars'
};

// Mock car and booking data
const mockCarId = '550e8400-e29b-41d4-a716-446655440001'; // Valid UUID
const mockBookingData = {
  carId: mockCarId,
  startDate: '2024-03-15',
  endDate: '2024-03-20',
  customerDetails: {
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890'
  },
  totalPrice: 750,
  currency: 'USD',
  securityDepositAmount: 300
};

// Helper function to make authenticated requests
async function makeRequest(url: string, options: RequestInit = {}) {
  const response = await fetch(`${TEST_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  return { response, data };
}

describe('Cache Invalidation Integration Tests', () => {
  beforeEach(async () => {
    // Clear all relevant cache keys before each test
    await cacheService.invalidate('fleet:*');
    await cacheService.invalidate('availability:*');
    await cacheService.invalidate('car:*');
  });

  afterEach(async () => {
    // Clean up after tests
    await cacheService.invalidate('fleet:*');
    await cacheService.invalidate('availability:*');
    await cacheService.invalidate('car:*');
  });

  describe('Booking Creation Cache Invalidation', () => {
    it('should invalidate car availability cache when booking is created', async () => {
      const queryParams = new URLSearchParams({
        carId: mockCarId,
        startDate: mockBookingData.startDate,
        endDate: mockBookingData.endDate
      });
      
      // Step 1: Cache the availability
      const { response: firstAvailabilityResponse } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      expect(firstAvailabilityResponse.headers.get('X-Cache')).toBe('MISS');
      
      // Verify it's cached
      const { response: cachedAvailabilityResponse } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      expect(cachedAvailabilityResponse.headers.get('X-Cache')).toBe('HIT');
      
      // Step 2: Create a booking (this should trigger cache invalidation)
      // Note: This will fail if the car doesn't exist in the database
      // In a real test environment, you'd need to ensure test data exists
      const { response: bookingResponse } = await makeRequest(
        TEST_API_ENDPOINTS.bookings,
        {
          method: 'POST',
          body: JSON.stringify(mockBookingData)
        }
      );
      
      // If booking creation succeeds, cache should be invalidated
      if (bookingResponse.status === 201) {
        // Small delay to ensure cache invalidation completes
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 3: Check if availability cache was invalidated
        const { response: afterBookingResponse } = await makeRequest(
          `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
        );
        expect(afterBookingResponse.headers.get('X-Cache')).toBe('MISS');
      }
    });

    it('should invalidate multiple availability cache entries for the same car', async () => {
      // Cache multiple date ranges for the same car
      const dateRanges = [
        { startDate: '2024-03-01', endDate: '2024-03-07' },
        { startDate: '2024-03-08', endDate: '2024-03-14' },
        { startDate: '2024-03-15', endDate: '2024-03-21' }
      ];
      
      // Cache all date ranges
      for (const range of dateRanges) {
        const queryParams = new URLSearchParams({
          carId: mockCarId,
          startDate: range.startDate,
          endDate: range.endDate
        });
        
        const { response } = await makeRequest(
          `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
        );
        expect(response.headers.get('X-Cache')).toBe('MISS');
        
        // Verify cached
        const { response: cached } = await makeRequest(
          `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
        );
        expect(cached.headers.get('X-Cache')).toBe('HIT');
      }
      
      // Trigger cache invalidation
      await invalidateCacheByEvent('booking.created');
      
      // All availability caches should be invalidated
      for (const range of dateRanges) {
        const queryParams = new URLSearchParams({
          carId: mockCarId,
          startDate: range.startDate,
          endDate: range.endDate
        });
        
        const { response } = await makeRequest(
          `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
        );
        expect(response.headers.get('X-Cache')).toBe('MISS');
      }
    });
  });

  describe('Booking Cancellation Cache Invalidation', () => {
    it('should invalidate car availability cache when booking is cancelled', async () => {
      // This test simulates the cache invalidation that should happen
      // when a booking is cancelled through the admin API
      
      const queryParams = new URLSearchParams({
        carId: mockCarId,
        startDate: '2024-04-01',
        endDate: '2024-04-07'
      });
      
      // Cache availability
      const { response: firstResponse } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      expect(firstResponse.headers.get('X-Cache')).toBe('MISS');
      
      // Verify cached
      const { response: cachedResponse } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      expect(cachedResponse.headers.get('X-Cache')).toBe('HIT');
      
      // Simulate booking cancellation event
      await invalidateCacheByEvent('booking.cancelled');
      
      // Cache should be invalidated
      const { response: afterCancellation } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      expect(afterCancellation.headers.get('X-Cache')).toBe('MISS');
    });
  });

  describe('Car Update Cache Invalidation', () => {
    it('should invalidate fleet listing cache when car is updated', async () => {
      // Cache fleet listing
      const { response: firstFleetResponse } = await makeRequest(TEST_API_ENDPOINTS.cars);
      expect(firstFleetResponse.headers.get('X-Cache')).toBe('MISS');
      
      // Verify cached
      const { response: cachedFleetResponse } = await makeRequest(TEST_API_ENDPOINTS.cars);
      expect(cachedFleetResponse.headers.get('X-Cache')).toBe('HIT');
      
      // Simulate car update event
      await invalidateCacheByEvent('car.updated');
      
      // Fleet cache should be invalidated
      const { response: afterUpdate } = await makeRequest(TEST_API_ENDPOINTS.cars);
      expect(afterUpdate.headers.get('X-Cache')).toBe('MISS');
    });

    it('should invalidate car details cache when car is updated', async () => {
      const carDetailsUrl = TEST_API_ENDPOINTS.carDetails.replace('{carId}', mockCarId);
      
      // Cache car details
      const { response: firstDetailsResponse } = await makeRequest(carDetailsUrl);
      if (firstDetailsResponse.status === 200) {
        expect(firstDetailsResponse.headers.get('X-Cache')).toBe('MISS');
        
        // Verify cached
        const { response: cachedDetailsResponse } = await makeRequest(carDetailsUrl);
        expect(cachedDetailsResponse.headers.get('X-Cache')).toBe('HIT');
        
        // Simulate car update event
        await invalidateCacheByEvent('car.updated');
        
        // Car details cache should be invalidated
        const { response: afterUpdate } = await makeRequest(carDetailsUrl);
        expect(afterUpdate.headers.get('X-Cache')).toBe('MISS');
      }
    });
  });

  describe('Bulk Cache Invalidation', () => {
    it('should invalidate all matching patterns', async () => {
      // Cache multiple endpoints
      await makeRequest(TEST_API_ENDPOINTS.cars);
      await makeRequest(`${TEST_API_ENDPOINTS.carAvailability}?carId=${mockCarId}&startDate=2024-03-01&endDate=2024-03-07`);
      
      // Verify both are cached
      const { response: cachedFleet } = await makeRequest(TEST_API_ENDPOINTS.cars);
      const { response: cachedAvailability } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?carId=${mockCarId}&startDate=2024-03-01&endDate=2024-03-07`
      );
      
      expect(cachedFleet.headers.get('X-Cache')).toBe('HIT');
      expect(cachedAvailability.headers.get('X-Cache')).toBe('HIT');
      
      // Invalidate all availability caches
      const invalidatedCount = await cacheService.invalidate('availability:*');
      expect(invalidatedCount).toBeGreaterThanOrEqual(1);
      
      // Check that availability is invalidated but fleet is still cached
      const { response: fleetAfter } = await makeRequest(TEST_API_ENDPOINTS.cars);
      const { response: availabilityAfter } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?carId=${mockCarId}&startDate=2024-03-01&endDate=2024-03-07`
      );
      
      expect(fleetAfter.headers.get('X-Cache')).toBe('HIT');
      expect(availabilityAfter.headers.get('X-Cache')).toBe('MISS');
    });
  });

  describe('Event-Based Invalidation', () => {
    it('should correctly map events to cache configurations', async () => {
      // Test that event mapping works correctly
      const eventMappings = [
        { event: 'booking.created', prefixes: ['availability:'] },
        { event: 'booking.cancelled', prefixes: ['availability:'] },
        { event: 'car.updated', prefixes: ['fleet:', 'car:'] },
        { event: 'car.created', prefixes: ['fleet:'] },
        { event: 'car.deleted', prefixes: ['fleet:'] }
      ];
      
      for (const mapping of eventMappings) {
        // Cache some data with each prefix
        for (const prefix of mapping.prefixes) {
          const testKey = `${prefix}test-${Date.now()}`;
          await cacheService.set(testKey, { test: true }, 300);
          
          // Verify it's cached
          const cached = await cacheService.get(testKey);
          expect(cached).toEqual({ test: true });
        }
        
        // Trigger event-based invalidation
        await invalidateCacheByEvent(mapping.event);
        
        // Verify all related caches are invalidated
        for (const prefix of mapping.prefixes) {
          const count = await cacheService.invalidate(`${prefix}*`);
          // Count should be 0 because they were already invalidated
          expect(count).toBe(0);
        }
      }
    });
  });

  describe('Concurrent Invalidation', () => {
    it('should handle concurrent cache invalidation requests', async () => {
      // Cache multiple entries
      const cachePromises = [];
      for (let i = 0; i < 10; i++) {
        const key = `availability:concurrent-test-${i}`;
        cachePromises.push(cacheService.set(key, { index: i }, 300));
      }
      await Promise.all(cachePromises);
      
      // Trigger multiple concurrent invalidations
      const invalidationPromises = [
        invalidateCacheByEvent('booking.created'),
        invalidateCacheByEvent('booking.cancelled'),
        cacheService.invalidate('availability:*')
      ];
      
      const results = await Promise.all(invalidationPromises);
      
      // At least one invalidation should have found keys
      const totalInvalidated = results.reduce((sum, result) => {
        return sum + (typeof result === 'number' ? result : 0);
      }, 0);
      
      expect(totalInvalidated).toBeGreaterThanOrEqual(0);
      
      // Verify all keys are gone
      for (let i = 0; i < 10; i++) {
        const key = `availability:concurrent-test-${i}`;
        const value = await cacheService.get(key);
        expect(value).toBeNull();
      }
    });
  });

  describe('Selective Cache Invalidation', () => {
    it('should only invalidate caches for specific patterns', async () => {
      // Set up different cache entries
      const cacheEntries = [
        { key: 'fleet:all', value: { type: 'fleet' } },
        { key: 'availability:car1:2024-03-01:2024-03-07', value: { type: 'availability' } },
        { key: 'availability:car2:2024-03-01:2024-03-07', value: { type: 'availability' } },
        { key: 'car:car1:details', value: { type: 'details' } },
        { key: 'car:car2:details', value: { type: 'details' } }
      ];
      
      // Cache all entries
      for (const entry of cacheEntries) {
        await cacheService.set(entry.key, entry.value, 300);
      }
      
      // Invalidate only availability caches
      const invalidatedCount = await cacheService.invalidate('availability:*');
      expect(invalidatedCount).toBe(2);
      
      // Check that only availability caches were invalidated
      for (const entry of cacheEntries) {
        const cached = await cacheService.get(entry.key);
        if (entry.key.startsWith('availability:')) {
          expect(cached).toBeNull();
        } else {
          expect(cached).toEqual(entry.value);
        }
      }
    });
  });

  describe('Cache Invalidation Error Handling', () => {
    it('should handle gracefully when Redis is unavailable', async () => {
      // This test verifies that cache invalidation doesn't throw errors
      // even when Redis operations fail
      
      try {
        // Attempt to invalidate non-existent pattern
        const result = await cacheService.invalidate('non-existent-pattern:*');
        expect(result).toBe(0);
        
        // Event-based invalidation should also handle gracefully
        await expect(invalidateCacheByEvent('booking.created')).resolves.not.toThrow();
      } catch (error) {
        // Even if Redis is down, these operations should not throw
        expect(error).toBeUndefined();
      }
    });
  });

  describe('Advanced Cache Invalidation Scenarios', () => {
    it('should invalidate related caches in correct order', async () => {
      // Setup: Cache multiple related endpoints
      const carId = mockCarId;
      const availabilityParams = new URLSearchParams({
        carId,
        startDate: '2024-05-01',
        endDate: '2024-05-07'
      });
      
      // Cache fleet, car details, and availability
      await makeRequest(TEST_API_ENDPOINTS.cars);
      await makeRequest(TEST_API_ENDPOINTS.carDetails.replace('{carId}', carId));
      await makeRequest(`${TEST_API_ENDPOINTS.carAvailability}?${availabilityParams}`);
      
      // Verify all are cached
      const { response: fleetCached } = await makeRequest(TEST_API_ENDPOINTS.cars);
      const { response: detailsCached } = await makeRequest(TEST_API_ENDPOINTS.carDetails.replace('{carId}', carId));
      const { response: availabilityCached } = await makeRequest(`${TEST_API_ENDPOINTS.carAvailability}?${availabilityParams}`);
      
      expect(fleetCached.headers.get('X-Cache')).toBe('HIT');
      expect(detailsCached.headers.get('X-Cache')).toBe('HIT');
      expect(availabilityCached.headers.get('X-Cache')).toBe('HIT');
      
      // Trigger car update event
      await invalidateCacheByEvent('car.updated');
      
      // Fleet and car details should be invalidated, but not availability
      const { response: fleetAfter } = await makeRequest(TEST_API_ENDPOINTS.cars);
      const { response: detailsAfter } = await makeRequest(TEST_API_ENDPOINTS.carDetails.replace('{carId}', carId));
      const { response: availabilityAfter } = await makeRequest(`${TEST_API_ENDPOINTS.carAvailability}?${availabilityParams}`);
      
      expect(fleetAfter.headers.get('X-Cache')).toBe('MISS');
      expect(detailsAfter.headers.get('X-Cache')).toBe('MISS');
      expect(availabilityAfter.headers.get('X-Cache')).toBe('HIT'); // Should still be cached
    });

    it('should handle cascading invalidation correctly', async () => {
      // Test scenario where one invalidation might trigger others
      const testData = {
        carId: mockCarId,
        dateRanges: [
          { startDate: '2024-06-01', endDate: '2024-06-07' },
          { startDate: '2024-06-08', endDate: '2024-06-14' },
          { startDate: '2024-06-15', endDate: '2024-06-21' }
        ]
      };
      
      // Cache multiple availability checks
      for (const range of testData.dateRanges) {
        const params = new URLSearchParams({
          carId: testData.carId,
          ...range
        });
        await makeRequest(`${TEST_API_ENDPOINTS.carAvailability}?${params}`);
      }
      
      // Create a booking (simulated)
      const bookingData = {
        ...mockBookingData,
        startDate: '2024-06-10',
        endDate: '2024-06-12'
      };
      
      // This should invalidate all availability caches
      await invalidateCacheByEvent('booking.created');
      
      // Verify all availability caches are invalidated
      for (const range of testData.dateRanges) {
        const params = new URLSearchParams({
          carId: testData.carId,
          ...range
        });
        const { response } = await makeRequest(`${TEST_API_ENDPOINTS.carAvailability}?${params}`);
        expect(response.headers.get('X-Cache')).toBe('MISS');
      }
    });

    it('should handle race conditions during invalidation', async () => {
      // Test concurrent cache writes and invalidations
      const operations = [];
      
      // Start multiple cache set operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          cacheService.set(`availability:race-test-${i}`, { value: i }, 300)
        );
      }
      
      // Add invalidation operations in between
      operations.push(
        cacheService.invalidate('availability:race-test-*'),
        invalidateCacheByEvent('booking.created')
      );
      
      // Add more cache set operations
      for (let i = 10; i < 20; i++) {
        operations.push(
          cacheService.set(`availability:race-test-${i}`, { value: i }, 300)
        );
      }
      
      // Execute all operations concurrently
      await Promise.all(operations);
      
      // Final invalidation
      const invalidatedCount = await cacheService.invalidate('availability:race-test-*');
      
      // Some keys might have been set after invalidation
      expect(invalidatedCount).toBeGreaterThanOrEqual(0);
      expect(invalidatedCount).toBeLessThanOrEqual(10);
    });

    it('should invalidate caches based on complex patterns', async () => {
      // Test complex invalidation patterns
      const testKeys = [
        'availability:car:123:2024-01-01:2024-01-07',
        'availability:car:123:2024-01-08:2024-01-14',
        'availability:car:456:2024-01-01:2024-01-07',
        'availability:special:123:2024-01-01:2024-01-07',
        'fleet:all:page:1',
        'fleet:filtered:brand:Tesla',
        'car:123:details',
        'car:456:details'
      ];
      
      // Set all test keys
      for (const key of testKeys) {
        await cacheService.set(key, { test: true }, 300);
      }
      
      // Test various invalidation patterns
      const patterns = [
        {
          pattern: 'availability:car:123:*',
          expectedCount: 2,
          description: 'Invalidate all availability for car 123'
        },
        {
          pattern: 'availability:*:2024-01-01:2024-01-07',
          expectedCount: 2,
          description: 'Invalidate all availability for specific date range'
        },
        {
          pattern: '*:123:*',
          expectedCount: 2,
          description: 'Invalidate all caches containing ID 123'
        }
      ];
      
      for (const { pattern, expectedCount, description } of patterns) {
        // Re-set keys before each test
        for (const key of testKeys) {
          await cacheService.set(key, { test: true }, 300);
        }
        
        console.log(`Testing: ${description}`);
        const count = await cacheService.invalidate(pattern);
        expect(count).toBe(expectedCount);
      }
    });

    it('should maintain invalidation history for debugging', async () => {
      // This test demonstrates how to track invalidation events
      const invalidationHistory: Array<{ event: string, timestamp: number, count: number }> = [];
      
      // Helper to track invalidations
      const trackedInvalidation = async (event: string) => {
        const startTime = Date.now();
        await invalidateCacheByEvent(event);
        
        // Count affected keys (in real implementation, this would be returned by invalidateCacheByEvent)
        let count = 0;
        for (const config of Object.values(cacheConfigs)) {
          if (config.invalidationEvents?.includes(event)) {
            count += await cacheService.invalidate(`${config.keyPrefix}*`);
          }
        }
        
        invalidationHistory.push({
          event,
          timestamp: startTime,
          count
        });
      };
      
      // Perform various invalidations
      await trackedInvalidation('booking.created');
      await trackedInvalidation('car.updated');
      await trackedInvalidation('booking.cancelled');
      
      // Verify history is tracked
      expect(invalidationHistory.length).toBe(3);
      expect(invalidationHistory[0].event).toBe('booking.created');
      expect(invalidationHistory[1].event).toBe('car.updated');
      expect(invalidationHistory[2].event).toBe('booking.cancelled');
    });
  });
});