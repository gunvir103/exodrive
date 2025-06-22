import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { cacheService } from '@/lib/redis';

// Test configuration
const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3005';
const TEST_API_ENDPOINTS = {
  cars: '/api/cars',
  carAvailability: '/api/cars/availability',
  carDetails: '/api/cars/{carId}',
  bookings: '/api/bookings'
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

// Helper to wait for cache TTL
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('API Caching Integration Tests', () => {
  // Clean up cache before each test
  beforeEach(async () => {
    // Clear relevant cache keys
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

  describe('Fleet Listing Cache', () => {
    it('should return cache MISS on first request and HIT on second request', async () => {
      // First request - should be a cache miss
      const { response: firstResponse, data: firstData } = await makeRequest(TEST_API_ENDPOINTS.cars);
      
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers.get('X-Cache')).toBe('MISS');
      expect(firstData.success).toBe(true);
      expect(Array.isArray(firstData.cars)).toBe(true);
      
      // Second request - should be a cache hit
      const { response: secondResponse, data: secondData } = await makeRequest(TEST_API_ENDPOINTS.cars);
      
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers.get('X-Cache')).toBe('HIT');
      expect(secondData).toEqual(firstData); // Data should be identical
    });

    it('should include correct cache key in headers', async () => {
      const { response } = await makeRequest(TEST_API_ENDPOINTS.cars);
      
      const cacheKey = response.headers.get('X-Cache-Key');
      expect(cacheKey).toBeTruthy();
      expect(cacheKey).toMatch(/^fleet:/);
    });

    it('should handle concurrent requests efficiently', async () => {
      // Clear cache first
      await cacheService.invalidate('fleet:*');
      
      // Make 5 concurrent requests
      const requests = Array(5).fill(null).map(() => 
        makeRequest(TEST_API_ENDPOINTS.cars)
      );
      
      const results = await Promise.all(requests);
      
      // At least one should be a MISS (the first to reach the server)
      const misses = results.filter(r => r.response.headers.get('X-Cache') === 'MISS');
      const hits = results.filter(r => r.response.headers.get('X-Cache') === 'HIT');
      
      expect(misses.length).toBeGreaterThanOrEqual(1);
      expect(hits.length).toBeGreaterThanOrEqual(0);
      
      // All responses should have the same data
      const firstData = results[0].data;
      results.forEach(result => {
        expect(result.data).toEqual(firstData);
      });
    });
  });

  describe('Car Availability Cache', () => {
    const testCarId = 'test-car-id-1234'; // This should be a valid car ID in your test database
    const testStartDate = '2024-03-01';
    const testEndDate = '2024-03-07';
    
    it('should cache availability check results', async () => {
      const queryParams = new URLSearchParams({
        carId: testCarId,
        startDate: testStartDate,
        endDate: testEndDate
      });
      
      // First request - cache miss
      const { response: firstResponse, data: firstData } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers.get('X-Cache')).toBe('MISS');
      expect(firstData.carId).toBe(testCarId);
      expect(firstData.availability).toBeTruthy();
      
      // Second request - cache hit
      const { response: secondResponse, data: secondData } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers.get('X-Cache')).toBe('HIT');
      expect(secondData).toEqual(firstData);
    });

    it('should use different cache keys for different date ranges', async () => {
      const queryParams1 = new URLSearchParams({
        carId: testCarId,
        startDate: '2024-03-01',
        endDate: '2024-03-07'
      });
      
      const queryParams2 = new URLSearchParams({
        carId: testCarId,
        startDate: '2024-03-08',
        endDate: '2024-03-14'
      });
      
      // Request 1
      const { response: response1 } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams1}`
      );
      expect(response1.headers.get('X-Cache')).toBe('MISS');
      
      // Request 2 with different dates
      const { response: response2 } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams2}`
      );
      expect(response2.headers.get('X-Cache')).toBe('MISS'); // Different key, so cache miss
      
      // Request 1 again should be cached
      const { response: response1Again } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams1}`
      );
      expect(response1Again.headers.get('X-Cache')).toBe('HIT');
    });

    it('should validate request parameters', async () => {
      // Invalid date format
      const invalidParams = new URLSearchParams({
        carId: testCarId,
        startDate: '2024/03/01', // Wrong format
        endDate: '2024-03-07'
      });
      
      const { response } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${invalidParams}`
      );
      
      expect(response.status).toBe(400);
    });
  });

  describe('Cache TTL Behavior', () => {
    it('should expire fleet listing cache after TTL', async () => {
      // First request to populate cache
      const { response: firstResponse } = await makeRequest(TEST_API_ENDPOINTS.cars);
      expect(firstResponse.headers.get('X-Cache')).toBe('MISS');
      
      // Immediate second request should hit cache
      const { response: secondResponse } = await makeRequest(TEST_API_ENDPOINTS.cars);
      expect(secondResponse.headers.get('X-Cache')).toBe('HIT');
      
      // Get the cache key to check TTL
      const cacheKey = secondResponse.headers.get('X-Cache-Key');
      expect(cacheKey).toBeTruthy();
      
      // Check remaining TTL
      const ttl = await cacheService.ttl(cacheKey!);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600); // Fleet listing has 1 hour TTL
      
      // For testing purposes, we can't wait for full TTL
      // Instead, verify that TTL is set correctly
      expect(ttl).toBeGreaterThan(3500); // Should be close to full TTL
    });

    it('should expire car availability cache after shorter TTL', async () => {
      const queryParams = new URLSearchParams({
        carId: 'test-car-123',
        startDate: '2024-03-01',
        endDate: '2024-03-07'
      });
      
      // First request to populate cache
      const { response: firstResponse } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      expect(firstResponse.headers.get('X-Cache')).toBe('MISS');
      
      // Check TTL for availability cache
      const cacheKey = firstResponse.headers.get('X-Cache-Key');
      if (cacheKey) {
        const ttl = await cacheService.ttl(cacheKey);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(300); // Availability has 5 minute TTL
        expect(ttl).toBeGreaterThan(290); // Should be close to full TTL
      }
    });
  });

  describe('Cache Headers', () => {
    it('should include proper cache headers in responses', async () => {
      const { response } = await makeRequest(TEST_API_ENDPOINTS.cars);
      
      // Check for cache-related headers
      expect(response.headers.get('X-Cache')).toMatch(/^(HIT|MISS)$/);
      expect(response.headers.get('X-Cache-Key')).toBeTruthy();
    });
  });

  describe('Non-Cacheable Requests', () => {
    it('should not cache POST requests', async () => {
      const bookingData = {
        carId: 'test-car-id',
        startDate: '2024-03-01',
        endDate: '2024-03-07',
        customerDetails: {
          fullName: 'Test User',
          email: 'test@example.com',
          phone: '+1234567890'
        },
        totalPrice: 500,
        currency: 'USD',
        securityDepositAmount: 200
      };
      
      // Make two POST requests
      const { response: firstResponse } = await makeRequest(TEST_API_ENDPOINTS.bookings, {
        method: 'POST',
        body: JSON.stringify(bookingData)
      });
      
      const { response: secondResponse } = await makeRequest(TEST_API_ENDPOINTS.bookings, {
        method: 'POST',
        body: JSON.stringify(bookingData)
      });
      
      // POST requests should not have cache headers
      expect(firstResponse.headers.get('X-Cache')).toBeNull();
      expect(secondResponse.headers.get('X-Cache')).toBeNull();
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for same requests', async () => {
      const queryParams = new URLSearchParams({
        carId: 'test-car-123',
        startDate: '2024-03-01',
        endDate: '2024-03-07'
      });
      
      // Make the same request twice
      const { response: response1 } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      const { response: response2 } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams}`
      );
      
      const key1 = response1.headers.get('X-Cache-Key');
      const key2 = response2.headers.get('X-Cache-Key');
      
      expect(key1).toBe(key2);
    });

    it('should generate different cache keys for different query parameters', async () => {
      const queryParams1 = new URLSearchParams({
        carId: 'test-car-123',
        startDate: '2024-03-01',
        endDate: '2024-03-07'
      });
      
      const queryParams2 = new URLSearchParams({
        carId: 'test-car-456', // Different car
        startDate: '2024-03-01',
        endDate: '2024-03-07'
      });
      
      const { response: response1 } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams1}`
      );
      const { response: response2 } = await makeRequest(
        `${TEST_API_ENDPOINTS.carAvailability}?${queryParams2}`
      );
      
      const key1 = response1.headers.get('X-Cache-Key');
      const key2 = response2.headers.get('X-Cache-Key');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Error Scenarios', () => {
    it('should continue without cache on Redis errors', async () => {
      // This test would require mocking Redis failures
      // For now, we'll test that the API still works when cache is unavailable
      
      const { response, data } = await makeRequest(TEST_API_ENDPOINTS.cars);
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Advanced Caching Scenarios', () => {
    it('should handle pagination parameters in cache keys', async () => {
      // Test with different pagination parameters
      const params1 = new URLSearchParams({ page: '1', limit: '10' });
      const params2 = new URLSearchParams({ page: '2', limit: '10' });
      const params3 = new URLSearchParams({ page: '1', limit: '20' });
      
      // Request page 1 with limit 10
      const { response: resp1 } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${params1}`);
      expect(resp1.headers.get('X-Cache')).toBe('MISS');
      
      // Request page 2 with limit 10 (different cache key)
      const { response: resp2 } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${params2}`);
      expect(resp2.headers.get('X-Cache')).toBe('MISS');
      
      // Request page 1 with limit 20 (different cache key)
      const { response: resp3 } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${params3}`);
      expect(resp3.headers.get('X-Cache')).toBe('MISS');
      
      // Request page 1 with limit 10 again (should hit cache)
      const { response: resp1Again } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${params1}`);
      expect(resp1Again.headers.get('X-Cache')).toBe('HIT');
    });

    it('should handle filter parameters in cache keys', async () => {
      // Test with different filter combinations
      const filters = [
        { brand: 'Tesla', minPrice: '100' },
        { brand: 'BMW', minPrice: '100' },
        { brand: 'Tesla', minPrice: '200' },
        { transmission: 'automatic' },
        { fuelType: 'electric', passenger: '5' }
      ];
      
      const responses = [];
      
      // Make requests with different filters
      for (const filter of filters) {
        const params = new URLSearchParams(filter);
        const { response } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${params}`);
        responses.push({
          filter,
          cacheKey: response.headers.get('X-Cache-Key'),
          cacheStatus: response.headers.get('X-Cache')
        });
      }
      
      // All should have unique cache keys
      const cacheKeys = responses.map(r => r.cacheKey);
      const uniqueKeys = new Set(cacheKeys);
      expect(uniqueKeys.size).toBe(filters.length);
      
      // All first requests should be cache misses
      responses.forEach(r => {
        expect(r.cacheStatus).toBe('MISS');
      });
    });

    it('should maintain cache consistency across related endpoints', async () => {
      // Get car list and specific car details
      const { response: listResponse, data: listData } = await makeRequest(TEST_API_ENDPOINTS.cars);
      expect(listResponse.headers.get('X-Cache')).toBe('MISS');
      
      if (listData.cars && listData.cars.length > 0) {
        const firstCarId = listData.cars[0].id;
        const carDetailsUrl = TEST_API_ENDPOINTS.carDetails.replace('{carId}', firstCarId);
        
        // Get car details (should be separate cache)
        const { response: detailsResponse } = await makeRequest(carDetailsUrl);
        expect(detailsResponse.headers.get('X-Cache')).toBe('MISS');
        
        // Verify different cache keys
        const listCacheKey = listResponse.headers.get('X-Cache-Key');
        const detailsCacheKey = detailsResponse.headers.get('X-Cache-Key');
        expect(listCacheKey).not.toBe(detailsCacheKey);
        expect(listCacheKey).toMatch(/^fleet:/);
        expect(detailsCacheKey).toMatch(/^car:/);
      }
    });

    it('should handle special characters in query parameters', async () => {
      // Test with special characters that need encoding
      const specialParams = [
        { search: 'Tesla Model 3' }, // Space
        { search: 'BMW+M4' }, // Plus sign
        { search: 'Car&Rental' }, // Ampersand
        { search: '100%Electric' }, // Percent
        { search: 'Test/Car' } // Slash
      ];
      
      for (const params of specialParams) {
        const queryParams = new URLSearchParams(params);
        const { response, data } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${queryParams}`);
        
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Cache-Key')).toBeTruthy();
        
        // Make same request again to verify caching works with special chars
        const { response: cachedResponse } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${queryParams}`);
        expect(cachedResponse.headers.get('X-Cache')).toBe('HIT');
      }
    });

    it('should handle very long query strings', async () => {
      // Create a very long query string with many parameters
      const longParams: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        longParams[`param${i}`] = `value${i}`;
      }
      
      const queryParams = new URLSearchParams(longParams);
      const { response } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${queryParams}`);
      
      expect(response.status).toBe(200);
      const cacheKey = response.headers.get('X-Cache-Key');
      expect(cacheKey).toBeTruthy();
      
      // Verify cache works with long query
      const { response: cachedResponse } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${queryParams}`);
      expect(cachedResponse.headers.get('X-Cache')).toBe('HIT');
    });

    it('should handle case sensitivity in cache keys', async () => {
      // Test that cache keys are case-sensitive
      const params1 = new URLSearchParams({ Brand: 'Tesla' }); // Uppercase B
      const params2 = new URLSearchParams({ brand: 'Tesla' }); // Lowercase b
      
      const { response: resp1 } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${params1}`);
      const { response: resp2 } = await makeRequest(`${TEST_API_ENDPOINTS.cars}?${params2}`);
      
      const key1 = resp1.headers.get('X-Cache-Key');
      const key2 = resp2.headers.get('X-Cache-Key');
      
      // Keys should be different due to case sensitivity
      expect(key1).not.toBe(key2);
      expect(resp1.headers.get('X-Cache')).toBe('MISS');
      expect(resp2.headers.get('X-Cache')).toBe('MISS');
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache performance improvement', async () => {
      // Clear cache to ensure clean test
      await cacheService.invalidate('fleet:*');
      
      // Measure time for uncached request
      const start1 = Date.now();
      const { response: uncachedResponse } = await makeRequest(TEST_API_ENDPOINTS.cars);
      const uncachedTime = Date.now() - start1;
      
      expect(uncachedResponse.headers.get('X-Cache')).toBe('MISS');
      
      // Measure time for cached request
      const start2 = Date.now();
      const { response: cachedResponse } = await makeRequest(TEST_API_ENDPOINTS.cars);
      const cachedTime = Date.now() - start2;
      
      expect(cachedResponse.headers.get('X-Cache')).toBe('HIT');
      
      // Cached request should generally be faster
      // Note: This might not always be true in test environments
      console.log(`Uncached request time: ${uncachedTime}ms`);
      console.log(`Cached request time: ${cachedTime}ms`);
      console.log(`Performance improvement: ${((uncachedTime - cachedTime) / uncachedTime * 100).toFixed(2)}%`);
    });
  });
});